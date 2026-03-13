import { Router } from 'express';
import { Readable } from 'node:stream';

export const router = Router();

// Track the last KoboldCpp API server URL for abort
let lastApiServer = '';

// Track the active generation AbortController so /abort can cancel fetch too
let activeGenerationController: AbortController | null = null;

// POST /api/backends/kobold/status
router.post('/status', async (req, res) => {
  try {
    let apiServer: string = req.body.api_server;
    if (!apiServer) return res.sendStatus(400);

    apiServer = apiServer.replace('localhost', '127.0.0.1');

    // Try KoboldCpp-specific endpoints first
    const [koboldUnitedResponse, koboldExtraResponse, koboldModelResponse] =
      await Promise.all([
        fetch(`${apiServer}/v1/info/version`)
          .then((r) => (r.ok ? r.json() : { result: '0.0.0' }))
          .catch(() => ({ result: '0.0.0' })),

        fetch(`${apiServer}/extra/version`)
          .then((r) => (r.ok ? r.json() : { version: '0.0' }))
          .catch(() => ({ version: '0.0' })),

        fetch(`${apiServer}/v1/model`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

    let modelName: string =
      !koboldModelResponse ||
      (koboldModelResponse as Record<string, string>).result === 'ReadOnly'
        ? ''
        : (koboldModelResponse as Record<string, string>).result ?? '';

    // Fallback: try OpenAI-compatible /v1/models (llama-server, vLLM, etc.)
    if (!modelName) {
      try {
        const modelsRes = await fetch(`${apiServer}/v1/models`);
        if (modelsRes.ok) {
          const data = await modelsRes.json() as { models?: Array<{ model?: string }> };
          modelName = data.models?.[0]?.model ?? '';
        }
      } catch { /* ignore */ }
    }

    const result = {
      koboldUnitedVersion: (koboldUnitedResponse as Record<string, string>).result,
      koboldCppVersion: (koboldExtraResponse as Record<string, string>).result,
      model: modelName || 'no_connection',
    };

    res.json(result);
  } catch (err) {
    console.error('[kobold/status]', err);
    res.json({ model: 'no_connection' });
  }
});

// POST /api/backends/kobold/abort — abort active KoboldCpp generation
// No body required — uses the api_server from the last /generate call
router.post('/abort', async (req, res) => {
  const server = req.body.api_server?.replace('localhost', '127.0.0.1') || lastApiServer;
  console.log('[kobold/abort] server=%s, hasController=%s', server, !!activeGenerationController);
  if (!server) {
    return res.json({ ok: false, reason: 'no server known' });
  }

  // 1. Tell KoboldCpp to stop generating
  try {
    await fetch(`${server}/extra/abort`, { method: 'POST' });
    console.log('[kobold/abort] KoboldCpp abort sent OK');
  } catch (err) {
    console.log('[kobold/abort] KoboldCpp abort failed:', (err as Error).message);
  }

  // 2. Abort the active fetch connection to KoboldCpp (stops stream piping)
  if (activeGenerationController) {
    activeGenerationController.abort();
    activeGenerationController = null;
    console.log('[kobold/abort] controller aborted');
  }

  res.json({ ok: true });
});

// POST /api/backends/kobold/generate-chat — via OpenAI-compatible /v1/chat/completions
// Sends structured messages instead of raw prompts; supports chat_template_kwargs
router.post('/generate-chat', async (req, res) => {
  if (!req.body) return res.sendStatus(400);

  let apiServer: string = req.body.api_server ?? '';
  apiServer = apiServer.replace('localhost', '127.0.0.1');
  lastApiServer = apiServer;

  const controller = new AbortController();
  activeGenerationController = controller;

  const onClose = () => {
    if (req.body.can_abort && !res.writableEnded) {
      console.log('[kobold/generate-chat] client disconnected, sending abort');
      fetch(`${apiServer}/extra/abort`, { method: 'POST' }).catch(() => {});
    }
    controller.abort();
    if (activeGenerationController === controller) {
      activeGenerationController = null;
    }
  };
  res.on('close', onClose);

  const settings: Record<string, unknown> = {
    messages: req.body.messages,
    max_tokens: req.body.max_length,
    temperature: req.body.temperature,
    top_p: req.body.top_p,
    top_k: req.body.top_k,
    min_p: req.body.min_p,
    rep_pen: req.body.rep_pen,
    rep_pen_range: req.body.rep_pen_range,
    presence_penalty: req.body.presence_penalty,
    stream: !!req.body.streaming,
  };

  if (req.body.stop_sequence) {
    settings.stop = req.body.stop_sequence;
  }

  // Pass chat_template_kwargs for models that support it (Qwen3.5, etc.)
  // KoboldCpp may ignore this, but llama.cpp server and vLLM support it
  if (req.body.chat_template_kwargs) {
    settings.chat_template_kwargs = req.body.chat_template_kwargs;
  }

  try {
    const url = `${apiServer}/v1/chat/completions`;
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const bodyJson = JSON.stringify(settings);
    console.log('[kobold/generate-chat] fetching %s (streaming=%s, msgCount=%d)',
      url, req.body.streaming, (req.body.messages ?? []).length);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log('[kobold/generate-chat] got response, status=%d', response.status);

    if (req.body.streaming) {
      res.statusCode = response.status;
      const ct = response.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);

      if (response.body && res.socket) {
        const nodeStream = Readable.fromWeb(
          response.body as import('node:stream/web').ReadableStream,
        );
        nodeStream.pipe(res);
        nodeStream.on('error', () => { if (!res.writableEnded) res.end(); });
        nodeStream.on('end', () => { if (!res.writableEnded) res.end(); });
      } else {
        res.end();
      }
    } else {
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({ error: { message: errorText } });
      }
      const data = await response.json();
      // Convert OpenAI chat completions response to our standard format
      // Thinking models (Qwen3.5, etc.) split output into reasoning_content + content
      const choice = (data as Record<string, unknown[]>)?.choices?.[0] as Record<string, Record<string, string>> | undefined;
      const reasoning = choice?.message?.reasoning_content ?? '';
      const msgContent = choice?.message?.content ?? '';
      const fullText = reasoning ? `<think>\n${reasoning}\n</think>\n\n${msgContent}` : msgContent;
      res.json({ results: [{ text: fullText }] });
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('[kobold/generate-chat] AbortError — cancelled');
      if (!res.writableEnded) res.end();
      return;
    }
    console.error('[kobold/generate-chat] error:', error);
    if (!res.headersSent) {
      res.json({ error: true });
    }
  } finally {
    if (activeGenerationController === controller) {
      activeGenerationController = null;
    }
    res.off('close', onClose);
  }
});

// POST /api/backends/kobold/generate
router.post('/generate', async (req, res) => {
  if (!req.body) return res.sendStatus(400);

  let apiServer: string = req.body.api_server ?? '';
  apiServer = apiServer.replace('localhost', '127.0.0.1');
  lastApiServer = apiServer;

  const controller = new AbortController();
  activeGenerationController = controller;

  // Clean up on client disconnect (listen on res, not req — req closes after body is read)
  const onClose = () => {
    if (req.body.can_abort && !res.writableEnded) {
      console.log('[kobold/generate] client disconnected during generation, sending abort');
      fetch(`${apiServer}/extra/abort`, { method: 'POST' }).catch(() => {});
    }
    controller.abort();
    if (activeGenerationController === controller) {
      activeGenerationController = null;
    }
  };
  res.on('close', onClose);

  const settings: Record<string, unknown> = {
    prompt: req.body.prompt,
    use_story: false,
    use_memory: false,
    use_authors_note: false,
    use_world_info: false,
    max_context_length: req.body.max_context_length,
    max_length: req.body.max_length,
    rep_pen: req.body.rep_pen,
    rep_pen_range: req.body.rep_pen_range,
    temperature: req.body.temperature,
    top_k: req.body.top_k,
    top_p: req.body.top_p,
    min_p: req.body.min_p,
    presence_penalty: req.body.presence_penalty,
    typical: req.body.typical,
    sampler_order: req.body.sampler_order,
  };

  if (req.body.stop_sequence) {
    settings.stop_sequence = req.body.stop_sequence;
  }

  try {
    const url = req.body.streaming
      ? `${apiServer}/extra/generate/stream`
      : `${apiServer}/v1/generate`;

    // Timeout so generation doesn't hang forever if model is not loaded
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const bodyJson = JSON.stringify(settings);
    console.log('[kobold/generate] fetching %s (streaming=%s, bodySize=%d, promptLen=%d, max_length=%s, max_ctx=%s)',
      url, req.body.streaming, bodyJson.length,
      (req.body.prompt ?? '').length,
      settings.max_length, settings.max_context_length);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    console.log('[kobold/generate] got response, status=%d', response.status);

    if (req.body.streaming) {
      // Pipe SSE stream, forwarding content-type so the client can detect SSE
      res.statusCode = response.status;
      const ct = response.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);

      if (response.body && res.socket) {
        const nodeStream = Readable.fromWeb(
          response.body as import('node:stream/web').ReadableStream,
        );
        nodeStream.pipe(res);

        nodeStream.on('error', () => {
          if (!res.writableEnded) res.end();
        });

        nodeStream.on('end', () => {
          if (!res.writableEnded) res.end();
        });
      } else {
        res.end();
      }
    } else {
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(400).json({ error: { message: errorText } });
      }

      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('[kobold/generate] AbortError caught — generation was cancelled');
      if (!res.writableEnded) res.end();
      return;
    }
    console.error('[kobold/generate] error:', error);
    if (!res.headersSent) {
      res.json({ error: true });
    }
  } finally {
    if (activeGenerationController === controller) {
      activeGenerationController = null;
    }
    res.off('close', onClose);
  }
});
