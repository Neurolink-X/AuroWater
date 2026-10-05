/**
 * src/lib/validation/time-slot-client.ts
 *
 * Client-side delivery-window logic.
 *  - Fixed 3-hour windows inside business hours (OPEN_HOUR → CLOSE_HOUR)
 *  - A window stays bookable until MIN_LEAD_MINUTES before it ends
 *  - Emergency bookings get an "ASAP" window (today only, ~1 hour)
 * The server remains the source of truth for hours; this is an early check.
 */

export const OPEN_HOUR = 7;
export const CLOSE_HOUR = 21;
export const SLOT_HOURS = 3;
export const MIN_LEAD_MINUTES = 60;
export const ASAP_SLOT_ID = 'asap';

const ASAP_LEAD_MINUTES = 20;
const ASAP_DURATION_MINUTES = 60;

export interface SlotBlock {
  id: string;
  label: string;
  icon: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface TimeSlotValue {
  date: string;
  slotId: string;
  startTime: string;
  endTime: string;
  time_slot: string;      // "HH:mm - HH:mm"
  scheduled_time: string; // ISO
  valid: boolean;
  errors: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m = 0) => `${pad(h)}:${pad(m)}`;

function describeBlock(startHour: number): { label: string; icon: string } {
  if (startHour < 10) return { label: 'Morning', icon: '🌅' };
  if (startHour < 13) return { label: 'Late morning', icon: '☀️' };
  if (startHour < 16) return { label: 'Afternoon', icon: '🌤️' };
  if (startHour < 19) return { label: 'Evening', icon: '🌇' };
  return { label: 'Night', icon: '🌙' };
}

function buildBlocks(): SlotBlock[] {
  const out: SlotBlock[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h += SLOT_HOURS) {
    const end = Math.min(h + SLOT_HOURS, CLOSE_HOUR);
    const { label, icon } = describeBlock(h);
    out.push({ id: `s${pad(h)}`, label, icon, startTime: hhmm(h), endTime: hhmm(end) });
  }
  return out;
}

export const SLOT_BLOCKS: SlotBlock[] = buildBlocks();

/* ───────────────────────── date helpers ───────────────────────── */

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar date (not UTC) so India evening is still "today". */
export function getMinDate(): string {
  return dateStr(new Date());
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function localDate(date: string, hhmmStr: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const mins = toMinutes(hhmmStr);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}

export function formatTime(minutes: number): string {
  return hhmm(Math.floor(minutes / 60), minutes % 60);
}

/* ───────────────────────── availability ───────────────────────── */

export function getSlotBlock(slotId: string | undefined): SlotBlock | undefined {
  return SLOT_BLOCKS.find((s) => s.id === slotId);
}

export function isSlotAvailable(date: string, block: SlotBlock, now: Date = new Date()): boolean {
  if (!date) return false;
  const end = localDate(date, block.endTime);
  return end.getTime() - now.getTime() >= MIN_LEAD_MINUTES * 60_000;
}

export function getAvailableSlots(date: string, now: Date = new Date()): SlotBlock[] {
  return SLOT_BLOCKS.filter((b) => isSlotAvailable(date, b, now));
}

function asapWindow(now: Date): { start: Date; end: Date } {
  const step = 5 * 60_000;
  const startMs = Math.ceil((now.getTime() + ASAP_LEAD_MINUTES * 60_000) / step) * step;
  return { start: new Date(startMs), end: new Date(startMs + ASAP_DURATION_MINUTES * 60_000) };
}

/** ASAP exists only for today and only if the whole hour fits before midnight. */
export function isAsapAvailable(date: string, now: Date = new Date()): boolean {
  if (date !== dateStr(now)) return false;
  const { start, end } = asapWindow(now);
  return dateStr(start) === date && dateStr(end) === date;
}

/* ───────────────────────── value builder ───────────────────────── */

export function buildSlotValue(date: string, slotId: string, now: Date = new Date()): TimeSlotValue {
  const errors: string[] = [];
  const empty: TimeSlotValue = {
    date, slotId, startTime: '', endTime: '', time_slot: '', scheduled_time: '', valid: false, errors,
  };

  if (!date) { errors.push('Date is required'); return empty; }

  if (slotId === ASAP_SLOT_ID) {
    if (!isAsapAvailable(date, now)) {
      errors.push('ASAP is only available today');
      return empty;
    }
    const { start, end } = asapWindow(now);
    const startTime = hhmm(start.getHours(), start.getMinutes());
    const endTime = hhmm(end.getHours(), end.getMinutes());
    return {
      date, slotId, startTime, endTime,
      time_slot: `${startTime} - ${endTime}`,
      scheduled_time: start.toISOString(),
      valid: true, errors,
    };
  }

  const block = getSlotBlock(slotId);
  if (!block) { errors.push('Choose a delivery window'); return empty; }
  if (!isSlotAvailable(date, block, now)) errors.push('This window is no longer available');

  const start = localDate(date, block.startTime);
  // Window already running today → schedule from "now + 30 min".
  const scheduled = start.getTime() > now.getTime() ? start : new Date(now.getTime() + 30 * 60_000);

  return {
    date,
    slotId: block.id,
    startTime: block.startTime,
    endTime: block.endTime,
    time_slot: `${block.startTime} - ${block.endTime}`,
    scheduled_time: scheduled.toISOString(),
    valid: errors.length === 0,
    errors,
  };
}

/** First bookable window on/after the preferred date (rolls to tomorrow if today is full). */
export function nextFutureSlot(preferredDate?: string): {
  date: string;
  slotId: string;
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const today = dateStr(now);
  const date = preferredDate && preferredDate > today ? preferredDate : today;

  const avail = getAvailableSlots(date, now);
  if (avail.length) {
    const s = avail[0];
    return { date, slotId: s.id, startTime: s.startTime, endTime: s.endTime };
  }

  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  const first = SLOT_BLOCKS[0];
  return { date: dateStr(t), slotId: first.id, startTime: first.startTime, endTime: first.endTime };
}

/* ─────────── Legacy helpers (kept so older imports don't break) ─────────── */

const MIN_SLOT_MINUTES = 30;
const TIME_REG = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

function parseMinutes(t: string): number | null {
  const m = t.trim().match(TIME_REG);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function validateTimeSlotClient(
  startTime: string,
  endTime: string,
  date: string,
): { valid: boolean; errors: string[]; time_slot: string; scheduled_time: string } {
  const errors: string[] = [];
  if (!startTime?.trim()) errors.push('Start time is required');
  if (!endTime?.trim()) errors.push('End time is required');
  if (!date?.trim()) errors.push('Date is required');

  const startM = startTime ? parseMinutes(startTime) : null;
  const endM = endTime ? parseMinutes(endTime) : null;
  if (startTime && startM === null) errors.push('Invalid start time (use HH:mm)');
  if (endTime && endM === null) errors.push('Invalid end time (use HH:mm)');

  if (startM !== null && endM !== null) {
    if (endM <= startM) errors.push('End time must be after start time');
    else if (endM - startM < MIN_SLOT_MINUTES) errors.push('Minimum slot duration is 30 minutes');
  }

  let scheduled_time = '';
  let time_slot = '';
  if (date && startM !== null && endM !== null) {
    const slotStart = localDate(date, formatTime(startM));
    if (slotStart.getTime() < Date.now()) errors.push('Time slot must be in the future');
    scheduled_time = slotStart.toISOString();
    time_slot = `${formatTime(startM)} - ${formatTime(endM)}`;
  }
  return { valid: errors.length === 0, errors, time_slot, scheduled_time };
}

export function getTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) options.push(hhmm(h, m));
  }
  return options;
}
















// /**
//  * Client-side time slot validation.
//  * Rules: required, end > start, min 30 minutes, future only.
//  */

// const MIN_SLOT_MINUTES = 30;
// const TIME_REG = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

// export interface TimeSlotValue {
//   startTime: string;  // "HH:mm"
//   endTime: string;    // "HH:mm"
//   date: string;       // "YYYY-MM-DD"
//   time_slot: string;  // "HH:mm - HH:mm"
//   scheduled_time: string; // ISO
//   valid: boolean;
//   errors: string[];
// }

// function parseMinutes(t: string): number | null {
//   const m = t.trim().match(TIME_REG);
//   if (!m) return null;
//   return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
// }

// function formatTime(minutes: number): string {
//   const h = Math.floor(minutes / 60);
//   const m = minutes % 60;
//   return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
// }

// export function validateTimeSlotClient(
//   startTime: string,
//   endTime: string,
//   date: string
// ): { valid: boolean; errors: string[]; time_slot: string; scheduled_time: string } {
//   const errors: string[] = [];

//   if (!startTime?.trim()) errors.push('Start time is required');
//   if (!endTime?.trim()) errors.push('End time is required');
//   if (!date?.trim()) errors.push('Date is required');

//   const startM = startTime ? parseMinutes(startTime) : null;
//   const endM = endTime ? parseMinutes(endTime) : null;

//   if (startTime && startM === null) errors.push('Invalid start time (use HH:mm)');
//   if (endTime && endM === null) errors.push('Invalid end time (use HH:mm)');

//   if (startM !== null && endM !== null) {
//     if (endM <= startM) errors.push('End time must be after start time');
//     else if (endM - startM < MIN_SLOT_MINUTES) errors.push('Minimum slot duration is 30 minutes');
//   }

//   let scheduled_time = '';
//   let time_slot = '';

//   if (date && startM !== null && endM !== null) {
//     const [y, m, d] = date.split('-').map(Number);
//     const slotStart = new Date(y, m - 1, d, Math.floor(startM / 60), startM % 60, 0, 0);
//     const now = new Date();
//     if (slotStart.getTime() < now.getTime()) {
//       errors.push('Time slot must be in the future');
//     }
//     scheduled_time = slotStart.toISOString();
//     time_slot = `${formatTime(startM)} - ${formatTime(endM)}`;
//   }

//   return {
//     valid: errors.length === 0,
//     errors,
//     time_slot,
//     scheduled_time,
//   };
// }

// /** Generate time options every 30 minutes */
// export function getTimeOptions(): string[] {
//   const options: string[] = [];
//   for (let h = 0; h < 24; h++) {
//     for (let m = 0; m < 60; m += 30) {
//       options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
//     }
//   }
//   return options;
// }

// /** Local calendar date (not UTC) so India evening is still “today”. */
// export function getMinDate(): string {
//   const d = new Date();
//   const y = d.getFullYear();
//   const m = String(d.getMonth() + 1).padStart(2, '0');
//   const day = String(d.getDate()).padStart(2, '0');
//   return `${y}-${m}-${day}`;
// }

// /** Next 30-minute slot that is still in the future. */
// export function nextFutureSlot(preferredDate?: string): { date: string; startTime: string; endTime: string } {
//   const now = new Date();
//   const today = getMinDate();
//   const date = preferredDate && preferredDate > today ? preferredDate : today;
//   if (date > today) {
//     return { date, startTime: '09:00', endTime: '09:30' };
//   }
//   const mins = now.getHours() * 60 + now.getMinutes();
//   const start = Math.ceil((mins + 1) / 30) * 30;
//   if (start + 30 >= 24 * 60) {
//     const t = new Date(now);
//     t.setDate(t.getDate() + 1);
//     const y = t.getFullYear();
//     const m = String(t.getMonth() + 1).padStart(2, '0');
//     const day = String(t.getDate()).padStart(2, '0');
//     return { date: `${y}-${m}-${day}`, startTime: '09:00', endTime: '09:30' };
//   }
//   return { date, startTime: formatTime(start), endTime: formatTime(start + 30) };
// }
