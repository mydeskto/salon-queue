import { CharacterSet, PrinterTypes, ThermalPrinter } from 'node-thermal-printer';
import { env } from '../env';

export interface ReceiptLine {
  name: string;
  price: string;
}

export interface ReceiptPayload {
  salonName: string;
  salonAddress?: string | null;
  salonPhone?: string | null;
  tokenNumber: string;
  customerName?: string | null;
  employeeName?: string | null;
  chairLabel?: string | null;
  receptionistName: string;
  items: ReceiptLine[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paymentMethod: string;
  issuedAt: Date;
}

export interface TokenTicketPayload {
  salonName: string;
  tokenNumber: string;
  chairLabel: string | null;
  employeeName: string | null;
  services: string[];
  estimatedWaitMinutes: number;
  queuePosition: number | null;
  issuedAt: Date;
}

export interface PrintResult {
  printed: boolean;
  reason?: string;
}

function createPrinter(): ThermalPrinter | null {
  if (!env.escpos.enabled || !env.escpos.interface) {
    return null;
  }
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: env.escpos.interface,
    characterSet: (CharacterSet as Record<string, CharacterSet>)[env.escpos.characterSet] ??
      CharacterSet.PC437_USA,
    width: env.escpos.width,
    removeSpecialCharacters: false,
    options: { timeout: 4000 },
  });
}

async function withPrinter(
  build: (printer: ThermalPrinter) => void,
): Promise<PrintResult> {
  const printer = createPrinter();
  if (!printer) {
    return { printed: false, reason: 'ESC/POS printing is disabled (ESCPOS_ENABLED=false)' };
  }
  try {
    const connected = await printer.isPrinterConnected();
    if (!connected) {
      return { printed: false, reason: `Printer unreachable at ${env.escpos.interface}` };
    }
    build(printer);
    await printer.execute();
    return { printed: true };
  } catch (error) {
    return { printed: false, reason: error instanceof Error ? error.message : 'Print failed' };
  }
}

export function renderBillText(payload: ReceiptPayload): string {
  const width = env.escpos.width;
  const line = (left: string, right: string) =>
    `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;

  const rows = [
    payload.salonName,
    payload.salonAddress ?? '',
    payload.salonPhone ?? '',
    '-'.repeat(width),
    line(`Token ${payload.tokenNumber}`, payload.issuedAt.toLocaleString()),
    payload.customerName ? `Customer: ${payload.customerName}` : '',
    payload.employeeName ? `Stylist: ${payload.employeeName}` : '',
    payload.chairLabel ? `Chair: ${payload.chairLabel}` : '',
    `Billed by: ${payload.receptionistName}`,
    '-'.repeat(width),
    ...payload.items.map((item) => line(item.name, item.price)),
    '-'.repeat(width),
    line('Subtotal', payload.subtotal),
    line('Discount', `-${payload.discount}`),
    line('Tax', payload.tax),
    line('TOTAL', payload.total),
    line('Paid by', payload.paymentMethod.toUpperCase()),
    '',
    'Thank you for visiting!',
  ];

  return rows.filter((row) => row !== '').join('\n');
}

export async function printBill(payload: ReceiptPayload): Promise<PrintResult> {
  return withPrinter((printer) => {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(payload.salonName);
    printer.setTextNormal();
    printer.bold(false);
    if (payload.salonAddress) printer.println(payload.salonAddress);
    if (payload.salonPhone) printer.println(payload.salonPhone);
    printer.drawLine();
    printer.alignLeft();
    printer.println(`Token: ${payload.tokenNumber}`);
    printer.println(`Date: ${payload.issuedAt.toLocaleString()}`);
    if (payload.customerName) printer.println(`Customer: ${payload.customerName}`);
    if (payload.employeeName) printer.println(`Stylist: ${payload.employeeName}`);
    if (payload.chairLabel) printer.println(`Chair: ${payload.chairLabel}`);
    printer.println(`Billed by: ${payload.receptionistName}`);
    printer.drawLine();
    for (const item of payload.items) {
      printer.leftRight(item.name, item.price);
    }
    printer.drawLine();
    printer.leftRight('Subtotal', payload.subtotal);
    printer.leftRight('Discount', `-${payload.discount}`);
    printer.leftRight('Tax', payload.tax);
    printer.bold(true);
    printer.leftRight('TOTAL', payload.total);
    printer.bold(false);
    printer.leftRight('Payment', payload.paymentMethod.toUpperCase());
    printer.newLine();
    printer.alignCenter();
    printer.println('Thank you for visiting!');
    printer.cut();
  });
}

export async function printTokenTicket(payload: TokenTicketPayload): Promise<PrintResult> {
  return withPrinter((printer) => {
    printer.alignCenter();
    printer.println(payload.salonName);
    printer.drawLine();
    printer.bold(true);
    printer.setTextSize(2, 2);
    printer.println(payload.tokenNumber);
    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();
    printer.alignLeft();
    printer.println(`Chair: ${payload.chairLabel ?? 'Assigned when free'}`);
    printer.println(`Stylist: ${payload.employeeName ?? 'Next available'}`);
    for (const service of payload.services) {
      printer.println(`- ${service}`);
    }
    if (payload.queuePosition) {
      printer.println(`Queue position: ${payload.queuePosition}`);
    }
    printer.println(`Estimated wait: ${payload.estimatedWaitMinutes} min`);
    printer.println(payload.issuedAt.toLocaleString());
    printer.newLine();
    printer.cut();
  });
}

export const printingEnabled = () => env.escpos.enabled && Boolean(env.escpos.interface);
