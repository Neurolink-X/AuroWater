/**
 * src/lib/validation/time-slot-client.ts
 *
 * Client-side time slot logic.
 * Fixed 3-hour delivery windows (Swiggy / Urban Company / Dunzo style):
 * the customer picks a window, not exact start/end times.
 */

/* ───────────────────────── 3-hour slot blocks ───────────────────────── */

export interface SlotBlock {
  id: string;
  label: string;
  icon: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export const SLOT_BLOCKS: SlotBlock[] = [
  { id: 's0600', label: 'Early morning', icon: '🌅', startTime: '06:00', endTime: '09:00' },
  { id: 's0900', label: 'Morning',       icon: '☀️', startTime: '09:00', endTime: '12:00' },
  { id: 's1200', label: 'Afternoon',     icon: '🌤️', startTime: '12:00', endTime: '15:00' },
  { id: 's1500', label: 'Evening',       icon: '🌇', startTime: '15:00', endTime: '18:00' },
  { id: 's1800', label: 'Night',         icon: '🌙', startTime: '18:00', endTime: '21:00' },
];

/** A window stays bookable until this many minutes before it ends. */
export const MIN_LEAD_MINUTES = 60;

export interface TimeSlotValue {
  date: string;           // "YYYY-MM-DD"
  slotId: string;
  startTime: string;      // "HH:mm"
  endTime: string;        // "HH:mm"
  time_slot: string;      // "HH:mm - HH:mm"
  scheduled_time: string; // ISO
  valid: boolean;
  errors: string[];
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function localDate(date: string, hhmm: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const mins = toMinutes(hhmm);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}

/** Local calendar date (not UTC) so India evening is still "today". */
export function getMinDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

/** Build the full value for a (date, slot) pair. */
export function buildSlotValue(date: string, slotId: string, now: Date = new Date()): TimeSlotValue {
  const block = getSlotBlock(slotId);
  const errors: string[] = [];
  if (!date) errors.push('Date is required');
  if (!block) errors.push('Choose a delivery window');

  if (!block || !date) {
    return { date, slotId, startTime: '', endTime: '', time_slot: '', scheduled_time: '', valid: false, errors };
  }

  if (!isSlotAvailable(date, block, now)) errors.push('This window is no longer available');

  const start = localDate(date, block.startTime);
  // If the window already started today, schedule from "now + 30 min".
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

/**
 * First bookable slot on/after the preferred date.
 * If nothing is left today, rolls to tomorrow's first window.
 */
export function nextFutureSlot(preferredDate?: string): {
  date: string;
  slotId: string;
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const today = getMinDate();
  const date = preferredDate && preferredDate > today ? preferredDate : today;

  const avail = getAvailableSlots(date, now);
  if (avail.length) {
    const s = avail[0];
    return { date, slotId: s.id, startTime: s.startTime, endTime: s.endTime };
  }

  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  const first = SLOT_BLOCKS[0];
  return { date: `${y}-${m}-${day}`, slotId: first.id, startTime: first.startTime, endTime: first.endTime };
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
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
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
