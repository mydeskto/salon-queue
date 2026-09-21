import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  APPOINTMENT_STATUSES,
  CHAIR_STATUSES,
  PAYMENT_METHODS,
  SALON_STATUSES,
  TOKEN_SOURCES,
  TOKEN_STATUSES,
  USER_ROLES,
} from '../../shared/src';

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const salonStatusEnum = pgEnum('salon_status', SALON_STATUSES);
export const chairStatusEnum = pgEnum('chair_status', CHAIR_STATUSES);
export const tokenStatusEnum = pgEnum('token_status', TOKEN_STATUSES);
export const tokenSourceEnum = pgEnum('token_source', TOKEN_SOURCES);
export const appointmentStatusEnum = pgEnum('appointment_status', APPOINTMENT_STATUSES);
export const paymentMethodEnum = pgEnum('payment_method', PAYMENT_METHODS);

export const salons = pgTable('salons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  address: varchar('address', { length: 400 }),
  phone: varchar('phone', { length: 40 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  status: salonStatusEnum('status').notNull().default('active'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id').references(() => salons.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 200 }).notNull(),
    phone: varchar('phone', { length: 40 }),
    // Nullable: an invited receptionist/admin or an un-paired kiosk device
    // has no password yet until they accept the invite / redeem a code.
    passwordHash: text('password_hash'),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // --- Receptionist / salon_admin email invites ---
    inviteToken: varchar('invite_token', { length: 64 }),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),

    // --- Kiosk device pairing ---
    pairingCode: varchar('pairing_code', { length: 12 }),
    pairingCodeExpiresAt: timestamp('pairing_code_expires_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_unique').on(table.email),
    salonIdx: index('users_salon_idx').on(table.salonId),
    inviteTokenIdx: uniqueIndex('users_invite_token_unique').on(table.inviteToken),
    pairingCodeIdx: uniqueIndex('users_pairing_code_unique').on(table.pairingCode),
  }),
);

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    shiftStart: time('shift_start'),
    shiftEnd: time('shift_end'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('employees_user_unique').on(table.userId),
    salonIdx: index('employees_salon_idx').on(table.salonId),
  }),
);

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    category: varchar('category', { length: 80 }),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    salonIdx: index('services_salon_idx').on(table.salonId),
  }),
);

/** Specialties: which services an employee is qualified to perform. */
export const employeeServices = pgTable(
  'employee_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pairIdx: uniqueIndex('employee_services_pair_unique').on(table.employeeId, table.serviceId),
  }),
);

export const chairs = pgTable(
  'chairs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 60 }).notNull(),
    status: chairStatusEnum('status').notNull().default('free'),
    currentTokenId: uuid('current_token_id'),
    currentEmployeeId: uuid('current_employee_id').references(() => employees.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    salonIdx: index('chairs_salon_idx').on(table.salonId),
    labelIdx: uniqueIndex('chairs_salon_label_unique').on(table.salonId, table.label),
  }),
);

export const tokens = pgTable(
  'tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    tokenNumber: varchar('token_number', { length: 20 }).notNull(),
    tokenDate: date('token_date')
      .notNull()
      .default(sql`CURRENT_DATE`),
    sequence: integer('sequence').notNull(),
    customerName: varchar('customer_name', { length: 120 }),
    customerPhone: varchar('customer_phone', { length: 40 }),
    chairId: uuid('chair_id').references(() => chairs.id, { onDelete: 'set null' }),
    employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),
    requestedEmployeeId: uuid('requested_employee_id').references(() => employees.id, {
      onDelete: 'set null',
    }),
    status: tokenStatusEnum('status').notNull().default('waiting'),
    source: tokenSourceEnum('source').notNull().default('kiosk'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    serviceStartedAt: timestamp('service_started_at', { withTimezone: true }),
    serviceCompletedAt: timestamp('service_completed_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => ({
    salonIdx: index('tokens_salon_idx').on(table.salonId),
    statusIdx: index('tokens_salon_status_idx').on(table.salonId, table.status),
    createdIdx: index('tokens_salon_created_idx').on(table.salonId, table.createdAt),
    numberIdx: uniqueIndex('tokens_salon_date_number_unique').on(
      table.salonId,
      table.tokenDate,
      table.tokenNumber,
    ),
  }),
);

export const tokenServices = pgTable(
  'token_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    priceAtBooking: numeric('price_at_booking', { precision: 10, scale: 2 }).notNull(),
    durationAtBooking: integer('duration_at_booking').notNull().default(30),
  },
  (table) => ({
    tokenIdx: index('token_services_token_idx').on(table.tokenId),
    serviceIdx: index('token_services_service_idx').on(table.serviceId),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    customerName: varchar('customer_name', { length: 120 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 40 }).notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    requestedEmployeeId: uuid('requested_employee_id').references(() => employees.id, {
      onDelete: 'set null',
    }),
    notes: varchar('notes', { length: 500 }),
    tokenId: uuid('token_id').references(() => tokens.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    salonIdx: index('appointments_salon_idx').on(table.salonId),
    scheduleIdx: index('appointments_salon_schedule_idx').on(table.salonId, table.scheduledFor),
  }),
);

export const appointmentServices = pgTable(
  'appointment_services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pairIdx: uniqueIndex('appointment_services_pair_unique').on(
      table.appointmentId,
      table.serviceId,
    ),
  }),
);

export const bills = pgTable(
  'bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => tokens.id, { onDelete: 'cascade' }),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    receptionistId: uuid('receptionist_id').references(() => users.id, { onDelete: 'set null' }),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 10, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 10, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    printedAt: timestamp('printed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('bills_token_unique').on(table.tokenId),
    salonIdx: index('bills_salon_idx').on(table.salonId),
    createdIdx: index('bills_salon_created_idx').on(table.salonId, table.createdAt),
  }),
);

export const billItems = pgTable(
  'bill_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    billId: uuid('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => ({
    billIdx: index('bill_items_bill_idx').on(table.billId),
  }),
);

/**
 * Nightly rollup of per-employee performance. Live dashboards query
 * `bills`/`tokens` directly; this table backs historical reporting without
 * re-scanning the transaction tables.
 */
export const dailyEmployeeStats = pgTable(
  'daily_employee_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    salonId: uuid('salon_id')
      .notNull()
      .references(() => salons.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    statDate: date('stat_date').notNull(),
    customersServed: integer('customers_served').notNull().default(0),
    servicesCompleted: integer('services_completed').notNull().default(0),
    revenueGenerated: numeric('revenue_generated', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    averageServiceMinutes: integer('average_service_minutes').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('daily_employee_stats_unique').on(table.employeeId, table.statDate),
    salonDateIdx: index('daily_employee_stats_salon_date_idx').on(table.salonId, table.statDate),
  }),
);

export const salonsRelations = relations(salons, ({ many }) => ({
  users: many(users),
  employees: many(employees),
  chairs: many(chairs),
  services: many(services),
  tokens: many(tokens),
  bills: many(bills),
}));

export const usersRelations = relations(users, ({ one }) => ({
  salon: one(salons, { fields: [users.salonId], references: [salons.id] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  salon: one(salons, { fields: [employees.salonId], references: [salons.id] }),
  specialties: many(employeeServices),
}));

export const employeeServicesRelations = relations(employeeServices, ({ one }) => ({
  employee: one(employees, { fields: [employeeServices.employeeId], references: [employees.id] }),
  service: one(services, { fields: [employeeServices.serviceId], references: [services.id] }),
}));

export const chairsRelations = relations(chairs, ({ one }) => ({
  salon: one(salons, { fields: [chairs.salonId], references: [salons.id] }),
  currentEmployee: one(employees, {
    fields: [chairs.currentEmployeeId],
    references: [employees.id],
  }),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  salon: one(salons, { fields: [tokens.salonId], references: [salons.id] }),
  chair: one(chairs, { fields: [tokens.chairId], references: [chairs.id] }),
  employee: one(employees, { fields: [tokens.employeeId], references: [employees.id] }),
  services: many(tokenServices),
  bill: one(bills),
}));

export const tokenServicesRelations = relations(tokenServices, ({ one }) => ({
  token: one(tokens, { fields: [tokenServices.tokenId], references: [tokens.id] }),
  service: one(services, { fields: [tokenServices.serviceId], references: [services.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  salon: one(salons, { fields: [appointments.salonId], references: [salons.id] }),
  token: one(tokens, { fields: [appointments.tokenId], references: [tokens.id] }),
  services: many(appointmentServices),
}));

export const appointmentServicesRelations = relations(appointmentServices, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentServices.appointmentId],
    references: [appointments.id],
  }),
  service: one(services, { fields: [appointmentServices.serviceId], references: [services.id] }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  token: one(tokens, { fields: [bills.tokenId], references: [tokens.id] }),
  salon: one(salons, { fields: [bills.salonId], references: [salons.id] }),
  receptionist: one(users, { fields: [bills.receptionistId], references: [users.id] }),
  items: many(billItems),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, { fields: [billItems.billId], references: [bills.id] }),
  service: one(services, { fields: [billItems.serviceId], references: [services.id] }),
}));
