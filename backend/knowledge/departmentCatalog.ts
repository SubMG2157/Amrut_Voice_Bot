/**
 * KIMS Hospital — Department Catalog
 * Authoritative source for departments, doctors, and availability.
 */

export type Department =
  | 'general_physician'
  | 'orthopedic'
  | 'dentist'
  | 'dermatology'
  | 'ophthalmology'
  | 'pediatrics';

export interface Doctor {
  id: string;
  nameEn: string;
  nameAr: string;
  department: Department;
  availableDays: number[]; // 0=Sun … 6=Sat
  slots: string[];         // 24h format e.g. ['10:00','14:00']
}

export interface DepartmentInfo {
  id: Department;
  nameEn: string;
  nameAr: string;
  doctors: Doctor[];
}

export const DOCTORS: Doctor[] = [
  // General Physician
  { id: 'dr_ahmed_ali',     nameEn: 'Dr. Ahmed Ali',     nameAr: 'د. أحمد علي',
    department: 'general_physician', availableDays: [0,1,2,3,4],
    slots: ['09:00','10:00','11:00','14:00','16:00','18:00'] },
  { id: 'dr_fatima_hassan', nameEn: 'Dr. Fatima Hassan', nameAr: 'د. فاطمة حسن',
    department: 'general_physician', availableDays: [1,3,6],
    slots: ['10:00','12:00','15:00','17:00'] },
  // Orthopedic
  { id: 'dr_khalid_omar',   nameEn: 'Dr. Khalid Omar',   nameAr: 'د. خالد عمر',
    department: 'orthopedic', availableDays: [0,2,4],
    slots: ['09:00','11:00','14:00','16:00','18:00'] },
  { id: 'dr_sara_mahmoud',  nameEn: 'Dr. Sara Mahmoud',  nameAr: 'د. سارة محمود',
    department: 'orthopedic', availableDays: [1,3,5],
    slots: ['10:00','13:00','15:00','17:00'] },
  // Dentist
  { id: 'dr_yousuf_nasser', nameEn: 'Dr. Yousuf Nasser', nameAr: 'د. يوسف ناصر',
    department: 'dentist', availableDays: [0,1,2,3,4,6],
    slots: ['09:00','10:30','12:00','14:00','15:30','17:00'] },
  // Dermatology
  { id: 'dr_layla_ibrahim', nameEn: 'Dr. Layla Ibrahim', nameAr: 'د. ليلى إبراهيم',
    department: 'dermatology', availableDays: [0,2,4],
    slots: ['10:00','11:30','14:00','16:00'] },
  // Ophthalmology
  { id: 'dr_omar_zayed',    nameEn: 'Dr. Omar Zayed',    nameAr: 'د. عمر زايد',
    department: 'ophthalmology', availableDays: [1,3,5],
    slots: ['09:00','11:00','14:00','16:30'] },
  // Pediatrics
  { id: 'dr_mariam_saeed',  nameEn: 'Dr. Mariam Saeed',  nameAr: 'د. مريم سعيد',
    department: 'pediatrics', availableDays: [0,1,2,3,4],
    slots: ['09:00','10:00','11:00','14:00','15:00','17:00'] },
];

export const DEPARTMENTS: DepartmentInfo[] = [
  { id: 'general_physician', nameEn: 'General Physician', nameAr: 'طبيب عام',
    doctors: DOCTORS.filter(d => d.department === 'general_physician') },
  { id: 'orthopedic',        nameEn: 'Orthopedic',        nameAr: 'العظام والمفاصل',
    doctors: DOCTORS.filter(d => d.department === 'orthopedic') },
  { id: 'dentist',           nameEn: 'Dentist',           nameAr: 'طب الأسنان',
    doctors: DOCTORS.filter(d => d.department === 'dentist') },
  { id: 'dermatology',       nameEn: 'Dermatology',       nameAr: 'الجلدية',
    doctors: DOCTORS.filter(d => d.department === 'dermatology') },
  { id: 'ophthalmology',     nameEn: 'Ophthalmology',     nameAr: 'طب العيون',
    doctors: DOCTORS.filter(d => d.department === 'ophthalmology') },
  { id: 'pediatrics',        nameEn: 'Pediatrics',        nameAr: 'طب الأطفال',
    doctors: DOCTORS.filter(d => d.department === 'pediatrics') },
];

// Symptom keyword → department mapping (used in prompt)
export const SYMPTOM_MAP: { keywords: string[]; department: Department; nameAr: string }[] = [
  { keywords: ['ظهر','عمود فقري','مفصل','ركبة','عظام','كسر','خلع','رقبة','كتف','ورك'],
    department: 'orthopedic', nameAr: 'العظام والمفاصل' },
  { keywords: ['حمى','سخونة','كحة','زكام','انفلونزا','ضعف','تعب','صداع','بطن','اسهال','قيء','ضغط','سكر'],
    department: 'general_physician', nameAr: 'طبيب عام' },
  { keywords: ['أسنان','سن','لثة','فم','ضرس','تسوس'],
    department: 'dentist', nameAr: 'طب الأسنان' },
  { keywords: ['جلد','حساسية','حبوب','طفح','حكة','بشرة','أكزيما'],
    department: 'dermatology', nameAr: 'الجلدية' },
  { keywords: ['عين','نظر','رؤية','ضبابية','دموع','حمرة عين'],
    department: 'ophthalmology', nameAr: 'طب العيون' },
  { keywords: ['طفل','رضيع','ولد','بنت','اطفال','مولود','تطعيم'],
    department: 'pediatrics', nameAr: 'طب الأطفال' },
];

export function getDepartmentById(id: Department): DepartmentInfo | undefined {
  return DEPARTMENTS.find(d => d.id === id);
}
export function getDoctorById(id: string): Doctor | undefined {
  return DOCTORS.find(d => d.id === id);
}
export function getDoctorsForDepartment(dept: Department): Doctor[] {
  return DOCTORS.filter(d => d.department === dept);
}
export function getDepartmentListForPrompt(): string {
  return DEPARTMENTS.map(d => `- ${d.nameAr} (${d.nameEn})`).join('\n');
}
export function getSymptomTableForPrompt(): string {
  return SYMPTOM_MAP.map(s =>
    `  كلمات: ${s.keywords.slice(0,4).join(', ')} → ${s.nameAr}`
  ).join('\n');
}

export const CLINIC_NAME_AR  = 'مستشفى كيمز';
export const CLINIC_NAME_EN  = 'KIMS Hospital';
export const CLINIC_ADDRESS  = 'KIMS Hospital, Main Branch';
export const CLINIC_MAPS_LINK = 'https://maps.google.com/?q=KIMS+Hospital';
