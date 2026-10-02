const SECTION_HEADER_MAP: Record<string, string> = {
  EXPERIENCE: 'EXPERIENCE',
  'WORK EXPERIENCE': 'EXPERIENCE',
  EMPLOYMENT: 'EXPERIENCE',
  'WORK HISTORY': 'EXPERIENCE',
  EDUCATION: 'EDUCATION',
  ACADEMIC: 'EDUCATION',
  CERTIFICATIONS: 'CERTIFICATIONS',
  CERTIFICATES: 'CERTIFICATIONS',
  PROJECTS: 'PROJECTS',
  SKILLS: 'SKILLS',
  'TECHNICAL SKILLS': 'SKILLS',
  'CORE COMPETENCIES': 'SKILLS',
  SUMMARY: 'SUMMARY',
  'PROFESSIONAL SUMMARY': 'SUMMARY',
  PROFILE: 'SUMMARY',
  ABOUT: 'SUMMARY',
};

export function matchSectionHeader(line: string): string | null {
  const normalized = line
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .trim();
  if (!normalized || normalized.length > 40) return null;
  return SECTION_HEADER_MAP[normalized] ?? null;
}

export function detectSectionOrder(text: string): string[] {
  const order: string[] = ['HEADER'];
  for (const rawLine of text.split(/\r?\n/)) {
    const key = matchSectionHeader(rawLine.trim());
    if (key && !order.includes(key)) order.push(key);
  }
  return order;
}

export function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentKey = 'HEADER';
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content) {
      const existing = sections.get(currentKey);
      sections.set(currentKey, existing ? `${existing}\n${content}` : content);
    }
    buffer = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerKey = matchSectionHeader(line);
    if (headerKey) {
      flush();
      currentKey = headerKey;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

export function normalizeSectionText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function sectionHeaderLabel(key: string): string {
  if (key === 'HEADER') return '';
  return key.charAt(0) + key.slice(1).toLowerCase();
}
