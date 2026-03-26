import twilio from 'twilio';
import { formatAppointmentSms } from './smsFormatter.js';
import type { AppointmentSmsPayload } from './smsFormatter.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_SMS_NUMBER;

/**
 * Legacy: Twilio SMS for appointment confirmations.
 * Hospital: Use this to send appointment SMS via Twilio (if credentials available).
 */
export async function sendAppointmentSmsTwilio(params: AppointmentSmsPayload): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!accountSid || !authToken || !twilioNumber) {
    // Fail gracefully — Plivo is primary
    return { success: false, error: 'Twilio credentials not configured (Plivo is primary)' };
  }

  const client = twilio(accountSid, authToken);

  // Format appointment SMS body
  const body = formatAppointmentSms(params);

  try {
    const message = await client.messages.create({
      body,
      from: twilioNumber,
      to: params.patientName, // Hospital: patient phone
    });

    console.log('[Twilio SMS] Sent to', params.phone, ':', message.sid);
    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error('[Twilio SMS] Failed:', err?.message);
    return { success: false, error: err?.message ?? 'SMS send failed' };
  }
}
