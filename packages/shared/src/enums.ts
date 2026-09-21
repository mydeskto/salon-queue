export const USER_ROLES = ['super_admin', 'salon_admin', 'receptionist', 'employee'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SALON_STATUSES = ['active', 'suspended'] as const;
export type SalonStatus = (typeof SALON_STATUSES)[number];

export const CHAIR_STATUSES = ['free', 'occupied', 'disabled'] as const;
export type ChairStatus = (typeof CHAIR_STATUSES)[number];

export const TOKEN_STATUSES = [
  'waiting',
  'in_service',
  'awaiting_payment',
  'completed',
  'cancelled',
] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const TOKEN_SOURCES = ['kiosk', 'appointment', 'reception'] as const;
export type TokenSource = (typeof TOKEN_SOURCES)[number];

export const APPOINTMENT_STATUSES = ['scheduled', 'checked_in', 'cancelled', 'no_show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * Allowed token status transitions. Receptionists drive every transition
 * (see project brief §9 Q1); employees have read-only queue access.
 */
export const TOKEN_TRANSITIONS: Record<TokenStatus, TokenStatus[]> = {
  waiting: ['in_service', 'cancelled'],
  in_service: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: TokenStatus, to: TokenStatus): boolean {
  return TOKEN_TRANSITIONS[from].includes(to);
}
