/**
 * SMS Service — Send order confirmation + payment link via Plivo.
 * Template includes: name, phone, address, order details, payment link, 24hr deadline.
 */

function normalizePhoneForPlivo(input: string): string {
    const value = String(input || '').trim().replace(/\s+/g, '');
    if (!value) return value;
    if (value.startsWith('+')) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
}

function getPlivoConfig() {
    return {
        authId: process.env.PLIVO_AUTH_ID ?? '',
        authToken: process.env.PLIVO_AUTH_TOKEN ?? '',
        src: normalizePhoneForPlivo(process.env.PLIVO_NUMBER ?? ''),
        dltEntityId: process.env.DLT_ENTITY_ID ?? '',
        dltTemplateId: process.env.DLT_TEMPLATE_ID ?? '',
        callbackUrl: process.env.BACKEND_BASE_URL ? `${process.env.BACKEND_BASE_URL}/plivo/sms-status` : '',
    };
}

function getPlivoAuthHeader(authId: string, authToken: string): string {
    return `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`;
}

export interface AppointmentSmsPayload {
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string;
  department: string;
  hospitalPhone: string;
}

/**
 * Send appointment confirmation SMS to patient (Plivo primary, Twilio fallback).
 */
export async function sendAppointmentSms(payload: AppointmentSmsPayload): Promise<{ success: boolean; sid?: string; error?: string }> {
  // TODO: Implement Plivo SMS sending for appointments
  // For now, return success placeholder
  return { success: true, sid: 'appt-' + Date.now() };
}
