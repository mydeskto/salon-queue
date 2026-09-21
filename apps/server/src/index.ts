import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { initRealtime } from './realtime';

const app = createApp();
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Salon server listening on http://localhost:${env.port}`);
  console.log(`Socket.IO ready (per-salon rooms: salon:{salonId})`);
});
