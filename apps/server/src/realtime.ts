import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  salonPublicRoom,
  salonRoom,
  type BillCompletedEvent,
  type ChairStatusChangedEvent,
  type ClientToServerEvents,
  type QueueUpdatedEvent,
  type ServerToClientEvents,
  type TokenCreatedEvent,
  type TokenStatusChangedEvent,
} from '@salon/shared';
import { verifyToken } from './auth/jwt';
import { env } from './env';

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/** Only staff of that salon (or the platform admin) may see customer-level events. */
function isStaffOf(salonId: string, token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = verifyToken(token);
    return payload.role === 'super_admin' || payload.salonId === salonId;
  } catch {
    return false;
  }
}

export function initRealtime(httpServer: HttpServer) {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('salon:join', ({ salonId, token }) => {
      if (typeof salonId !== 'string' || salonId.length === 0) return;
      void socket.join(isStaffOf(salonId, token) ? salonRoom(salonId) : salonPublicRoom(salonId));
    });
    socket.on('salon:leave', ({ salonId }) => {
      if (typeof salonId !== 'string' || salonId.length === 0) return;
      void socket.leave(salonRoom(salonId));
      void socket.leave(salonPublicRoom(salonId));
    });
  });

  return io;
}

function emitStaff<T>(salonId: string, event: keyof ServerToClientEvents, payload: T) {
  io?.to(salonRoom(salonId)).emit(event, payload as never);
}

function emitEveryone<T>(salonId: string, event: keyof ServerToClientEvents, payload: T) {
  io?.to([salonRoom(salonId), salonPublicRoom(salonId)]).emit(event, payload as never);
}

export const realtime = {
  chairStatusChanged(payload: ChairStatusChangedEvent) {
    emitEveryone(payload.salonId, SOCKET_EVENTS.chairStatusChanged, payload);
  },
  tokenCreated(payload: TokenCreatedEvent) {
    emitStaff(payload.salonId, SOCKET_EVENTS.tokenCreated, payload);
  },
  tokenStatusChanged(payload: TokenStatusChangedEvent) {
    emitStaff(payload.salonId, SOCKET_EVENTS.tokenStatusChanged, payload);
  },
  queueUpdated(payload: QueueUpdatedEvent) {
    emitEveryone(payload.salonId, SOCKET_EVENTS.queueUpdated, payload);
  },
  billCompleted(payload: BillCompletedEvent) {
    emitStaff(payload.salonId, SOCKET_EVENTS.billCompleted, payload);
  },
};
