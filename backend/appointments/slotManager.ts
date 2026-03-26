/**
 * KIMS Hospital — Slot Manager
 * Manages doctor availability and booking state.
 */

import { DOCTORS, getDoctorsForDepartment, type Department, type Doctor } from '../knowledge/departmentCatalog.js';

const bookedSlots = new Set<string>();

function slotKey(doctorId: string, date: string, time: string): string {
  return `${doctorId}::${date}::${time}`;
}

function doctorWorksOn(doctor: Doctor, date: string): boolean {
  return doctor.availableDays.includes(new Date(date).getDay());
}

export function getAvailableSlots(doctorId: string, date: string): string[] {
  const doctor = DOCTORS.find(d => d.id === doctorId);
  if (!doctor || !doctorWorksOn(doctor, date)) return [];
  return doctor.slots.filter(t => !bookedSlots.has(slotKey(doctorId, date, t)));
}

export function getTopSlotsForDepartment(
  dept: Department, date: string, limit = 3
): { doctor: Doctor; time: string }[] {
  const results: { doctor: Doctor; time: string }[] = [];
  for (const doctor of getDoctorsForDepartment(dept)) {
    for (const time of getAvailableSlots(doctor.id, date)) {
      results.push({ doctor, time });
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function bookSlot(doctorId: string, date: string, time: string): boolean {
  const key = slotKey(doctorId, date, time);
  if (bookedSlots.has(key)) return false;
  bookedSlots.add(key);
  return true;
}

export function releaseSlot(doctorId: string, date: string, time: string): void {
  bookedSlots.delete(slotKey(doctorId, date, time));
}

/** "14:00" → "2:00 مساءً" */
export function formatTimeAr(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'صباحاً' : 'مساءً';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,'0')} ${suffix}`;
}

/** "2025-03-16" → "الأحد 16 مارس 2025" */
export function formatDateAr(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function todayStr(): string  { return new Date().toISOString().slice(0,10); }
export function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10);
}
