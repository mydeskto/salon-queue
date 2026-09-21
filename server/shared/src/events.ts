import type { ChairStatus, TokenStatus } from './enums';

export const SOCKET_EVENTS = {
  chairStatusChanged: 'chair:status_changed',
  tokenCreated: 'token:created',
  tokenStatusChanged: 'token:status_changed',
  queueUpdated: 'queue:updated',
  billCompleted: 'bill:completed',
} as const;

export function salonRoom(salonId: string): string {
  return `salon:${salonId}`;
}

/**
 * Anonymous kiosk clients join this room instead of the staff room: it only
 * carries queue positions and chair availability, never customer details.
 */
export function salonPublicRoom(salonId: string): string {
  return `salon:${salonId}:public`;
}

export interface ChairStatusChangedEvent {
  salonId: string;
  chairId: string;
  label: string;
  status: ChairStatus;
  currentTokenId: string | null;
  currentEmployeeId: string | null;
}

export interface TokenSummary {
  id: string;
  salonId: string;
  tokenNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  chairId: string | null;
  chairLabel: string | null;
  employeeId: string | null;
  employeeName: string | null;
  status: TokenStatus;
  services: Array<{ serviceId: string; name: string; price: string; durationMinutes: number }>;
  totalPrice: string;
  estimatedDurationMinutes: number;
  createdAt: string;
  serviceStartedAt: string | null;
  serviceCompletedAt: string | null;
  paidAt: string | null;
}

export interface TokenCreatedEvent {
  salonId: string;
  token: TokenSummary;
  queuePosition: number | null;
  estimatedWaitMinutes: number;
}

export interface TokenStatusChangedEvent {
  salonId: string;
  token: TokenSummary;
  previousStatus: TokenStatus;
}

export interface QueueEntry {
  tokenId: string;
  tokenNumber: string;
  position: number;
  estimatedWaitMinutes: number;
  requestedEmployeeId: string | null;
}

export interface QueueUpdatedEvent {
  salonId: string;
  waiting: QueueEntry[];
}

export interface BillCompletedEvent {
  salonId: string;
  billId: string;
  tokenId: string;
  total: string;
  paymentMethod: string;
  completedAt: string;
}

export interface ServerToClientEvents {
  'chair:status_changed': (payload: ChairStatusChangedEvent) => void;
  'token:created': (payload: TokenCreatedEvent) => void;
  'token:status_changed': (payload: TokenStatusChangedEvent) => void;
  'queue:updated': (payload: QueueUpdatedEvent) => void;
  'bill:completed': (payload: BillCompletedEvent) => void;
}

export interface ClientToServerEvents {
  'salon:join': (payload: { salonId: string; token?: string }) => void;
  'salon:leave': (payload: { salonId: string }) => void;
}
