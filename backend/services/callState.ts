/**
 * Call State Machine — Tracks appointment conversation stage per call.
 */

export enum CallStage {
    GREETING = 'GREETING',
    IDENTITY_CHECK = 'IDENTITY_CHECK',
    CONSENT = 'CONSENT',
    SYMPTOM_CAPTURE = 'SYMPTOM_CAPTURE',
    DEPARTMENT_SELECTION = 'DEPARTMENT_SELECTION',
    SLOT_SELECTION = 'SLOT_SELECTION',
    APPOINTMENT_CONFIRM = 'APPOINTMENT_CONFIRM',
    APPOINTMENT_SMS = 'APPOINTMENT_SMS',
    CALLBACK_DAY = 'CALLBACK_DAY',
    CALLBACK_TIME = 'CALLBACK_TIME',
    NOTE_CAPTURE = 'NOTE_CAPTURE',
    CLOSED = 'CLOSED',
}

interface CallState {
    stage: CallStage;
    patientName: string;
    departmentName?: string;
    doctorId?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    symptoms?: string;
    callbackDay?: string;
    callbackTime?: string;
    notes?: string;
}

const callStates = new Map<string, CallState>();

export function initCallState(callSid: string, patientName: string, departmentName = 'general_physician'): void {
    callStates.set(callSid, {
        stage: CallStage.GREETING,
        patientName,
        departmentName,
    });
}

export function getCallState(callSid: string): CallState | undefined {
    return callStates.get(callSid);
}

export function getCallStage(callSid: string): CallStage {
    return callStates.get(callSid)?.stage ?? CallStage.GREETING;
}

export function updateStage(callSid: string, stage: CallStage): void {
    const state = callStates.get(callSid);
    if (state) {
        state.stage = stage;
        console.log(`[CallState] ${callSid} → ${stage}`);
    }
}

export function updateCallState(callSid: string, updates: Partial<CallState>): void {
    const state = callStates.get(callSid);
    if (state) {
        Object.assign(state, updates);
    }
}

export function deleteCallState(callSid: string): void {
    callStates.delete(callSid);
}
