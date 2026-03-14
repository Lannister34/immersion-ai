// ── Message formatting utilities ─────────────────────────────────────────────

/** Parse a dialogue block, alternating between dialogue (bright) and narration (muted).
 *  Russian pattern: «Dialogue, — narration. — More dialogue.»
 *  Transitions happen at: punctuation [,!?.…] followed by space+em-dash+space */
function colorizeDialogueSegments(text: string): string {
  const bright = (s: string): string => (s ? `<span class='dlg'>${s}</span>` : '');
  const transitionRegex = /[,!?.…]\s*—\s/g;
  const splits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = transitionRegex.exec(text)) !== null) {
    splits.push(m.index + 1); // split after the punctuation mark
  }
  if (splits.length === 0) return bright(text); // all dialogue

  const parts: string[] = [];
  let pos = 0;
  let isDialogue = true;
  for (const splitAt of splits) {
    const segment = text.slice(pos, splitAt);
    parts.push(isDialogue ? bright(segment) : segment);
    isDialogue = !isDialogue;
    pos = splitAt;
  }
  const rest = text.slice(pos);
  if (rest) parts.push(isDialogue ? bright(rest) : rest);
  return parts.join('');
}

/** Highlight dialogue segments in bright color within muted-base assistant text */
function highlightDialogue(html: string): string {
  const bright = (s: string): string => (s ? `<span class='dlg'>${s}</span>` : '');

  // 1. «Guillemet» blocks — parse internal dialogue/narration alternation
  html = html.replace(/«([^»]+)»/g, (_m, inner: string) => {
    return `«${colorizeDialogueSegments(inner)}»`;
  });

  // 2. "Straight quotes" — entire quoted text is dialogue
  html = html.replace(/"([^"]+)"/g, (_m, inner: string) => bright(`"${inner}"`));
  // 3. \u201cCurly quotes\u201d
  html = html.replace(/\u201c([^\u201d]+)\u201d/g, (_m, inner: string) => bright(`\u201c${inner}\u201d`));

  // 4. Em-dash dialogue at line/paragraph start: — text, — narration.
  html = html.replace(/(^|\n)(—\s)(.+)/gm, (_m, prefix: string, dash: string, rest: string) => {
    return `${prefix}${colorizeDialogueSegments(dash + rest)}`;
  });

  return html;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function formatMarkdown(text: string, applyColors = false): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  if (applyColors) {
    // Highlight dialogue in bright color while narration stays muted (container default)
    html = highlightDialogue(html);
  }
  html = html.replace(/\n/g, '<br/>');
  return html;
}

/** Strip <think>...</think> blocks from text, returning only the actual response */
export function stripThinkBlocks(text: string): string {
  // Remove complete <think>...</think> blocks
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // Remove unclosed <think>... (model stopped mid-think)
  result = result.replace(/<think>[\s\S]*$/g, '');
  return result.trim();
}

/**
 * Parse <think>...</think> blocks from model output and render them
 * as collapsible sections. Handles both complete and streaming (unclosed) blocks.
 */
export function formatMessageContent(text: string, isStreaming = false): string {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const thinkStart = remaining.indexOf('<think>');
    if (thinkStart === -1) {
      // No more think blocks — format rest as normal text with colors
      parts.push(formatMarkdown(remaining, true));
      break;
    }

    // Text before <think> — with colors
    if (thinkStart > 0) {
      parts.push(formatMarkdown(remaining.slice(0, thinkStart), true));
    }

    const afterTag = remaining.slice(thinkStart + 7); // after "<think>"
    const thinkEnd = afterTag.indexOf('</think>');

    if (thinkEnd === -1) {
      // Unclosed think block (streaming or broken output)
      const thinkContent = formatMarkdown(afterTag.trim());
      if (isStreaming && thinkContent) {
        // Show as open/pulsing block during streaming
        parts.push(
          `<div class="think-block-open"><div class="think-header">💭 Размышления...</div><div class="think-content">${thinkContent}</div></div>`,
        );
      } else if (thinkContent) {
        // Completed message with unclosed think — show as collapsible
        parts.push(
          `<details class="think-block"><summary>💭 Размышления</summary><div class="think-content">${thinkContent}</div></details>`,
        );
      }
      break; // nothing after unclosed block
    }

    // Closed think block — collapsible
    const thinkContent = formatMarkdown(afterTag.slice(0, thinkEnd).trim());
    if (thinkContent) {
      parts.push(
        `<details class="think-block"><summary>💭 Размышления</summary><div class="think-content">${thinkContent}</div></details>`,
      );
    }
    remaining = afterTag.slice(thinkEnd + 8); // after "</think>"
  }

  return parts.join('');
}
