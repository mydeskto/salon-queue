import { createServer } from 'node:http';
import { createApp } from './app';
import { ensureBootstrapAdmin } from './bootstrapAdmin';
import { env } from './env';
import { initRealtime } from './realtime';

async function main() {
  await ensureBootstrapAdmin();

  const app = createApp();
  const httpServer = createServer(app);
  initRealtime(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`Salon server listening on http://localhost:${env.port}`);
    console.log(`Socket.IO ready (per-salon rooms: salon:{salonId})`);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
