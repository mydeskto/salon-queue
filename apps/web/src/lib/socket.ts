"use client";

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@salon/shared';
import { getStoredToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

type SalonSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Joins the salon room and re-runs `onChange` whenever the server broadcasts a
 * queue, chair, token, or bill change for that salon.
 */
export function useSalonEvents(salonId: string | null | undefined, onChange: () => void): void {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!salonId) return;
    const socket: SalonSocket = io(WS_URL, { transports: ['websocket'] });
    const refresh = () => handler.current();

    socket.on('connect', () =>
      socket.emit('salon:join', { salonId, token: getStoredToken() ?? undefined }),
    );
    socket.on('queue:updated', refresh);
    socket.on('token:created', refresh);
    socket.on('token:status_changed', refresh);
    socket.on('chair:status_changed', refresh);
    socket.on('bill:completed', refresh);

    return () => {
      socket.emit('salon:leave', { salonId });
      socket.disconnect();
    };
  }, [salonId]);
}
