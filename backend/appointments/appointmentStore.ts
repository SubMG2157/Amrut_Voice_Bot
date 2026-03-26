/**
 * KIMS Hospital — Appointment Store
 * In-memory appointment persistence.
 */

import { releaseSlot } from './slotManager.js';
import type { Department } from '../knowledge/departmentCatalog.js';

export type AppointmentStatus = 'pending'|'confirmed'|'cancelled'|'rescheduled'|'completed';

export interface AppointmentItem {
  appointmentId: string;
  patientName: string;
  phone: string;
  age?: string;
  isNewPatient: boolean;
  department: Department;
  departmentNameAr: string;
  departmentNameEn: string;
  doctorId: string;
  doctorNameAr: string;
  doctorNameEn: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  tokenNumber: number;
  smsSent: boolean;
  createdAt: number;
  reminderSent24h: boolean;
  reminderSent2h: boolean;
  callId?: string;
}

const appointments = new Map<string, AppointmentItem>();
let tokenCounter = 1000;
let idCounter = 1;

function generateAppointmentId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random()*chars.length)];
  return `KIMS-${rand}-${idCounter++}`;
}

export function saveAppointment(
  data: Omit<AppointmentItem,'appointmentId'|'tokenNumber'|'smsSent'|'createdAt'|'reminderSent24h'|'reminderSent2h'>
): AppointmentItem {
  const item: AppointmentItem = {
    ...data,
    appointmentId: generateAppointmentId(),
    tokenNumber: ++tokenCounter,
    smsSent: false,
    createdAt: Date.now(),
    reminderSent24h: false,
    reminderSent2h: false,
  };
  appointments.set(item.appointmentId, item);
  return item;
}

export function getAppointment(id: string): AppointmentItem | undefined {
  return appointments.get(id);
}

export function updateAppointmentStatus(id: string, status: AppointmentStatus): AppointmentItem | null {
  const a = appointments.get(id);
  if (!a) return null;
  a.status = status;
  return a;
}

export function rescheduleAppointment(
  id: string, newDate: string, newTime: string,
  newDoctorId: string, newDoctorNameAr: string, newDoctorNameEn: string
): AppointmentItem | null {
  const a = appointments.get(id);
  if (!a) return null;
  releaseSlot(a.doctorId, a.date, a.time);
  a.date = newDate; a.time = newTime;
  a.doctorId = newDoctorId; a.doctorNameAr = newDoctorNameAr; a.doctorNameEn = newDoctorNameEn;
  a.status = 'rescheduled';
  a.reminderSent24h = false; a.reminderSent2h = false; a.smsSent = false;
  return a;
}

export function markSmsSent(id: string): void {
  const a = appointments.get(id); if (a) a.smsSent = true;
}

export function markReminderSent(id: string, type: '24h'|'2h'): void {
  const a = appointments.get(id); if (!a) return;
  if (type === '24h') a.reminderSent24h = true; else a.reminderSent2h = true;
}

export function getAppointmentsNeedingReminder24h(): AppointmentItem[] {
  const t = new Date(); t.setDate(t.getDate()+1);
  const ts = t.toISOString().slice(0,10);
  return [...appointments.values()].filter(
    a => a.date === ts && !a.reminderSent24h && a.status === 'confirmed'
  );
}

export function getAppointmentsNeedingReminder2h(): AppointmentItem[] {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  return [...appointments.values()].filter(a => {
    if (a.date !== today || a.reminderSent2h || a.status !== 'confirmed') return false;
    const diff = (new Date(`${a.date}T${a.time}:00`).getTime() - now.getTime()) / 60000;
    return diff >= 100 && diff <= 130;
  });
}

export function getAllAppointments(): AppointmentItem[] {
  return [...appointments.values()].sort((a,b) => b.createdAt - a.createdAt);
}

export function getAppointmentsByPhone(phone: string): AppointmentItem[] {
  return [...appointments.values()].filter(a => a.phone === phone);
}
