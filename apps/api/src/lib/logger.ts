import pino from 'pino';

export function buildApiLogger() {
  return pino({
    level: 'info',
    name: 'immersion-api',
  });
}
