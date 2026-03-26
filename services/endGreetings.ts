export type EndGreetingLang = 'en' | 'mr' | 'hi';

export const END_GREETING: Record<EndGreetingLang, string[]> = {
  en: [
    'Thank you.',
    'Thank you for your time.',
    'Have a great day.',
  ],
  mr: [
    'धन्यवाद.',
    'अमृत सरकारी योजना पोर्टल वापरल्याबद्दल धन्यवाद.',
    'शुभ दिवस.',
  ],
  hi: [
    'धन्यवाद।',
    'अमृत सरकारी योजना पोर्टल का उपयोग करने के लिए धन्यवाद।',
    'आपका दिन शुभ हो।',
  ],
};

/** Map app language (English/Arabic) to end-greeting key. */
export function languageToEndGreetingLang(language: string): EndGreetingLang {
  const L: Record<string, EndGreetingLang> = {
    English: 'en',
    Marathi: 'mr',
    Hindi: 'hi',
  };
  return L[language] ?? 'mr';
}

/** Preferred short closing (first in list) for the given language. */
export function getEndGreeting(lang: EndGreetingLang): string {
  return END_GREETING[lang][0];
}

/** Get closing phrase for the given app language (e.g. from ctx.language). */
export function getEndGreetingForAppLanguage(language: string): string {
  return getEndGreeting(languageToEndGreetingLang(language));
}

/** All phrases for detection (hangup when agent says any of these). */
export function getAllEndGreetingPhrases(): string[] {
  const list: string[] = [];
  for (const arr of Object.values(END_GREETING)) {
    list.push(...arr);
  }
  return list;
}
