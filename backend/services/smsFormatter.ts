export interface SchemeSmsPayload {
  userName: string;
  category: string;
  schemeId?: string;
  portalPhone: string;
}

export function formatSchemeSms(payload: SchemeSmsPayload): string {
  const schemeLine = payload.schemeId ? `\nयोजना संदर्भ: ${payload.schemeId}` : '';
  return `नमस्कार ${payload.userName},

अमृत सरकारी योजना पोर्टलशी बोलल्याबद्दल धन्यवाद.
वर्ग: ${payload.category}${schemeLine}

अधिक माहितीसाठी हेल्पलाईन:
${payload.portalPhone}

धन्यवाद - अमृत सरकारी योजना पोर्टल सहाय्यक`;
}

/**
 * Lightweight sender used by reminder scheduler.
 * In production, route this through the SMS provider integration.
 */
export async function sendHospitalSms(phone: string, message: string): Promise<{ success: boolean; sid: string }> {
  console.log(`[SchemeSMS] To ${phone}: ${message}`);
  return { success: true, sid: `scheme-${Date.now()}` };
}
