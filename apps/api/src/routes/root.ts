import type { FastifyPluginAsync } from 'fastify';

const DEFAULT_WEB_PORT = '4788';

function getWebPort() {
  return process.env.IMMERSION_WEB_PORT?.trim() || DEFAULT_WEB_PORT;
}

function resolveWebRedirectUrl(requestHost: string | undefined) {
  const webPort = getWebPort();

  if (!requestHost) {
    return `http://127.0.0.1:${webPort}/chat`;
  }

  try {
    const url = new URL(`http://${requestHost}`);

    url.port = webPort;
    url.pathname = '/chat';
    url.search = '';
    url.hash = '';

    return url.toString();
  } catch {
    return `http://127.0.0.1:${webPort}/chat`;
  }
}

export const rootRoute: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    return reply.redirect(resolveWebRedirectUrl(request.headers.host));
  });
};
