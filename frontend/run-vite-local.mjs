import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
await server.listen();
server.printUrls();
