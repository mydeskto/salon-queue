import { z } from 'zod';
import {
  CHAIR_STATUSES,
  PAYMENT_METHODS,
  SALON_STATUSES,
  TOKEN_STATUSES,
  USER_ROLES,
} from './enums';

const uuid = z.string().uuid();
const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'must be a decimal amount with at most 2 decimals');

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Accepts either a full URL (https://...) or a relative path returned by
// POST /api/uploads/image (e.g. /uploads/<file>.png).
const imageUrl = z
  .string()
  .max(500)
  .refine((value) => /^https?:\/\//.test(value) || value.startsWith('/uploads/'), {
    message: 'must be an http(s) URL or an /uploads/ path',
  });

export const createSalonSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().max(400).optional(),
  phone: z.string().max(40).optional(),
  logoUrl: imageUrl.optional(),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).optional(),
});
export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const updateSalonSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(400).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  logoUrl: imageUrl.nullable().optional(),
  status: z.enum(SALON_STATUSES).optional(),
});
export type UpdateSalonInput = z.infer<typeof updateSalonSchema>;

export const createServiceSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  category: z.string().max(80).optional(),
  price: money,
  durationMinutes: z.number().int().min(1).max(600),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const createChairSchema = z.object({
  label: z.string().min(1).max(60),
});
export type CreateChairInput = z.infer<typeof createChairSchema>;

export const updateChairSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  status: z.enum(CHAIR_STATUSES).optional(),
});
export type UpdateChairInput = z.infer<typeof updateChairSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  password: z.string().min(8),
  serviceIds: z.array(uuid).default([]),
  shiftStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  shiftEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  password: z.string().min(8).optional(),
  serviceIds: z.array(uuid).optional(),
  shiftStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  shiftEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/**
 * Invites a human staff member (receptionist or salon_admin) by email —
 * no password is set by the admin. The invitee gets a link to
 * /invite/:token where they choose their own password.
 */
export const inviteStaffUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  role: z.enum(USER_ROLES).refine((r) => r === 'receptionist' || r === 'salon_admin', {
    message: 'role must be receptionist or salon_admin',
  }),
});
export type InviteStaffUserInput = z.infer<typeof inviteStaffUserSchema>;

/** Registers a kiosk screen device. No password — it's paired with a short code instead. */
export const createKioskDeviceSchema = z.object({
  name: z.string().min(2).max(120),
});
export type CreateKioskDeviceInput = z.infer<typeof createKioskDeviceSchema>;

export const updateStaffUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffUserInput = z.infer<typeof updateStaffUserSchema>;

/** Step 2 of the receptionist/admin invite flow: the invitee sets their own password. */
export const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** A kiosk tablet redeems the short-lived pairing code shown by the admin. */
export const redeemPairingCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, 'must be a 6-character code')),
});
export type RedeemPairingCodeInput = z.infer<typeof redeemPairingCodeSchema>;

export const kioskCheckInSchema = z.object({
  salonId: uuid,
  serviceIds: z.array(uuid).min(1),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  /** Optional employee preference (project brief §9 Q2). */
  requestedEmployeeId: uuid.optional(),
  appointmentId: uuid.optional(),
});
export type KioskCheckInInput = z.infer<typeof kioskCheckInSchema>;

export const createAppointmentSchema = z.object({
  salonId: uuid,
  serviceIds: z.array(uuid).min(1),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(4).max(40),
  scheduledFor: z.string().datetime(),
  requestedEmployeeId: uuid.optional(),
  notes: z.string().max(500).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateTokenStatusSchema = z.object({
  status: z.enum(TOKEN_STATUSES),
});
export type UpdateTokenStatusInput = z.infer<typeof updateTokenStatusSchema>;

export const assignTokenSchema = z.object({
  chairId: uuid,
  employeeId: uuid.optional(),
});
export type AssignTokenInput = z.infer<typeof assignTokenSchema>;

export const createBillSchema = z.object({
  tokenId: uuid,
  discount: money.default('0'),
  taxRate: z.number().min(0).max(100).default(0),
  paymentMethod: z.enum(PAYMENT_METHODS),
  items: z
    .array(
      z.object({
        serviceId: uuid,
        price: money,
      }),
    )
    .optional(),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const reportRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  employeeId: uuid.optional(),
});
export type ReportRangeInput = z.infer<typeof reportRangeSchema>;
