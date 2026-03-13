import { createServer } from 'vite';

const server = await createServer({
  configFile: './vite.config.ts',
  server: { port: 4778, strictPort: true },
});
await server.listen();
server.printUrls();
