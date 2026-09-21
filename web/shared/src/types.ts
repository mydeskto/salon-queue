import type {
  AppointmentStatus,
  ChairStatus,
  PaymentMethod,
  SalonStatus,
  TokenSource,
  UserRole,
} from './enums';
import type { TokenSummary } from './events';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  salonId: string | null;
  salonName: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Salon {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  status: SalonStatus;
  createdAt: string;
}

export interface SalonWithStats extends Salon {
  employeeCount: number;
  chairCount: number;
  tokensToday: number;
  revenueToday: string;
}

export interface Service {
  id: string;
  salonId: string;
  name: string;
  description: string | null;
  category: string | null;
  price: string;
  durationMinutes: number;
  isActive: boolean;
}

export interface Chair {
  id: string;
  salonId: string;
  label: string;
  status: ChairStatus;
  currentTokenId: string | null;
  currentTokenNumber: string | null;
  currentEmployeeId: string | null;
  currentEmployeeName: string | null;
}

export interface Employee {
  id: string;
  userId: string;
  salonId: string;
  name: string;
  email: string;
  phone: string | null;
  serviceIds: string[];
  shiftStart: string | null;
  shiftEnd: string | null;
  isActive: boolean;
  onShift: boolean;
}

export type StaffAccountStatus = 'active' | 'invited' | 'unpaired';

export interface StaffUser {
  id: string;
  salonId: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  /**
   * 'invited': a receptionist/salon_admin who hasn't accepted their email
   * invite yet. 'unpaired': a kiosk device that hasn't redeemed a pairing
   * code yet. 'active': normal, signed-in-capable account.
   */
  status: StaffAccountStatus;
  /** Kiosk devices only — when the device last made an authenticated request. */
  lastSeenAt: string | null;
  /** Present only while an invite/pairing code is outstanding (never after redemption). */
  pairingCodeExpiresAt: string | null;
}

/** Returned once, right after creating/resending an invite — never stored client-side. */
export interface StaffInviteResult {
  staff: StaffUser;
  inviteUrl: string;
  expiresAt: string;
}

/** Returned once, right after generating/regenerating a kiosk pairing code. */
export interface KioskPairingResult {
  staff: StaffUser;
  code: string;
  expiresAt: string;
}

export interface Appointment {
  id: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  scheduledFor: string;
  status: AppointmentStatus;
  requestedEmployeeId: string | null;
  requestedEmployeeName: string | null;
  notes: string | null;
  tokenId: string | null;
  services: Array<{ serviceId: string; name: string; price: string; durationMinutes: number }>;
}

export interface Bill {
  id: string;
  salonId: string;
  tokenId: string;
  tokenNumber: string;
  receptionistId: string;
  receptionistName: string;
  customerName: string | null;
  employeeName: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paymentMethod: PaymentMethod;
  printedAt: string | null;
  createdAt: string;
  items: Array<{ serviceId: string; name: string; price: string }>;
}

export interface CheckInResult {
  token: TokenSummary;
  source: TokenSource;
  queuePosition: number | null;
  estimatedWaitMinutes: number;
}

export interface KioskSalonInfo {
  salon: Pick<Salon, 'id' | 'name' | 'address' | 'phone' | 'logoUrl'>;
  services: Service[];
  employees: Array<Pick<Employee, 'id' | 'name' | 'serviceIds' | 'onShift'>>;
  freeChairs: number;
  waitingCount: number;
}

export interface EmployeeStat {
  employeeId: string;
  employeeName: string;
  customersServed: number;
  servicesCompleted: number;
  revenue: string;
  averageServiceMinutes: number;
}

export interface ServiceStat {
  serviceId: string;
  serviceName: string;
  timesPerformed: number;
  revenue: string;
}

export interface SalonOverviewReport {
  from: string;
  to: string;
  totalTokens: number;
  completedTokens: number;
  cancelledTokens: number;
  totalRevenue: string;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
  chairUtilizationPercent: number;
  cancellationRatePercent: number;
  peakHours: Array<{ hour: number; tokens: number }>;
  revenueByDay: Array<{ date: string; revenue: string; tokens: number }>;
  employees: EmployeeStat[];
  services: ServiceStat[];
}

export interface EmployeeHistoryRow {
  tokenId: string;
  tokenNumber: string;
  customerName: string | null;
  services: string[];
  total: string;
  completedAt: string | null;
  paidAt: string | null;
}

export interface CustomerDirectoryRow {
  customerPhone: string;
  customerName: string | null;
  visits: number;
  totalSpend: string;
  lastVisitAt: string | null;
}

export interface PlatformOverview {
  totalSalons: number;
  activeSalons: number;
  suspendedSalons: number;
  tokensToday: number;
  tokensThisMonth: number;
  revenueToday: string;
  revenueThisMonth: string;
  salons: SalonWithStats[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
