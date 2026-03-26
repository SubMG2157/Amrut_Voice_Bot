/**
 * KIMS Hospital — Reminder Scheduler
 * Sends appointment reminders via cron at 9 AM and 2 PM daily.
 * Reminders sent 24h before and 2h before appointment times.
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { getAppointmentsNeedingReminder24h, getAppointmentsNeedingReminder2h, markReminderSent } from '../appointments/appointmentStore.js';
import { sendHospitalSms } from './smsFormatter.js';

export async function runReminderCheck(): Promise<void> {
  console.log('[ReminderScheduler] Checking appointments...');

  // 24h reminders
  const recall24 = getAppointmentsNeedingReminder24h();
  for (const appt of recall24) {
    const msg = `تذكير: موعدك غداً الساعة ${appt.time} عند د. ${appt.doctorNameAr}. الرجاء التأكيد أو الإلغاء.`;
    try {
      await sendHospitalSms(appt.phone, msg);
      markReminderSent(appt.appointmentId, '24h');
      console.log(`[ReminderScheduler] 24h reminder sent: ${appt.appointmentId}`);
    } catch (err) {
      console.error(`[ReminderScheduler] Failed to send 24h reminder:`, err);
    }
  }

  // 2h reminders
  const recall2 = getAppointmentsNeedingReminder2h();
  for (const appt of recall2) {
    const msg = `تذكير أخير: موعدك خلال ساعتين الساعة ${appt.time}. يرجى الحضور.`;
    try {
      await sendHospitalSms(appt.phone, msg);
      markReminderSent(appt.appointmentId, '2h');
      console.log(`[ReminderScheduler] 2h reminder sent: ${appt.appointmentId}`);
    } catch (err) {
      console.error(`[ReminderScheduler] Failed to send 2h reminder:`, err);
    }
  }
}

let morningScheduler: ScheduledTask | null = null;
let afternoonScheduler: ScheduledTask | null = null;

export function startReminderScheduler(): void {
  if (morningScheduler || afternoonScheduler) return;
  // 9 AM daily
  morningScheduler = cron.schedule('0 9 * * *', () => {
    void runReminderCheck();
  });
  // 2 PM daily
  afternoonScheduler = cron.schedule('0 14 * * *', () => {
    void runReminderCheck();
  });
  console.log('[ReminderScheduler] Started');
}

export function stopReminderScheduler(): void {
  if (morningScheduler) {
    morningScheduler.stop();
    morningScheduler = null;
  }
  if (afternoonScheduler) {
    afternoonScheduler.stop();
    afternoonScheduler = null;
  }
}
