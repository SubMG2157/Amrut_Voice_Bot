import type { Scheme } from '../../backend/knowledge/schemeCatalog.ts';

/**
 * Browser-safe prompt seed.
 * Keep lightweight so frontend bundle does not import Node-only modules.
 */
export const PROMPT_SCHEME_SEED: Scheme[] = [
  {
    id: 'pmay',
    category: 'housing',
    nameMr: 'प्रधानमंत्री आवास योजना',
    nameHi: 'प्रधानमंत्री आवास योजना',
    nameEn: 'Pradhan Mantri Awas Yojana',
    description: 'परवडणाऱ्या घरांसाठी कर्ज अनुदान योजना',
    eligibility: {},
    benefits: ['घरकर्जावर व्याज अनुदान'],
    documentsRequired: ['आधार कार्ड', 'उत्पन्न प्रमाणपत्र'],
    applicationProcess: 'अधिकृत पोर्टलवर ऑनलाइन अर्ज करा.',
  },
  {
    id: 'ujjwala',
    category: 'women_empowerment',
    nameMr: 'प्रधानमंत्री उज्ज्वला योजना',
    nameHi: 'प्रधानमंत्री उज्ज्वला योजना',
    nameEn: 'Pradhan Mantri Ujjwala Yojana',
    description: 'महिलांसाठी LPG जोडणी सहाय्य',
    eligibility: {},
    benefits: ['LPG जोडणी मदत'],
    documentsRequired: ['आधार कार्ड'],
    applicationProcess: 'जवळच्या वितरकाकडे अर्ज करा.',
  },
];

