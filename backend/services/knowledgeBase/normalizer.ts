export interface RawKnowledgeRecord {
  title: string;
  description: string;
  source: 'public' | 'authenticated';
  url: string;
}

export interface RawKnowledgeSnapshot {
  startedAt: string;
  endedAt: string;
  totalPages: number;
  totalSchemes: number;
  records: RawKnowledgeRecord[];
  warnings: string[];
}

export interface NormalizedScheme {
  id: string;
  title: string;
  description: string;
  category: string;
  source: 'public' | 'authenticated';
  url: string;
}

export interface NormalizedKnowledge {
  generatedAt: string;
  schemes: NormalizedScheme[];
  stats: {
    totalSchemes: number;
    byCategory: Record<string, number>;
  };
}

function inferCategory(text: string): string {
  const t = text.toLowerCase();
  if (/house|housing|आवास|घर/.test(t)) return 'housing';
  if (/women|महिला|स्त्री/.test(t)) return 'women_empowerment';
  if (/educat|शिक्षण|छात्र/.test(t)) return 'education';
  if (/health|आरोग्य|स्वास्थ्य/.test(t)) return 'health';
  if (/farmer|agri|कृषि|शेती/.test(t)) return 'agriculture';
  return 'general';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function normalizeScrapeResult(raw: RawKnowledgeSnapshot): NormalizedKnowledge {
  const schemes: NormalizedScheme[] = raw.records.map((r) => {
    const category = inferCategory(`${r.title} ${r.description}`);
    return {
      id: slugify(`${r.title}-${category}`),
      title: r.title,
      description: r.description,
      category,
      source: r.source,
      url: r.url,
    };
  });

  const byCategory: Record<string, number> = {};
  for (const s of schemes) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    schemes,
    stats: {
      totalSchemes: schemes.length,
      byCategory,
    },
  };
}

