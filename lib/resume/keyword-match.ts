export function normalizeKeyword(kw: string): string {
  return kw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ing$|ed$|s$/i, '')
    .trim();
}

export function computeKeywordMatch(
  resume: string,
  keywords: string[]
): { matched: string[]; missing: string[]; score: number } {
  const resumeNorm = normalizeKeyword(resume);
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    const kw = normalizeKeyword(keyword);
    if (!kw) continue;
    if (resumeNorm.includes(kw)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score =
    keywords.length > 0
      ? Math.round((matched.length / keywords.length) * 100)
      : 0;

  return { matched, missing, score };
}

export function resumeToSearchText(resume: {
  basics: { name?: string; summary?: string; label?: string };
  work?: Array<{ summary?: string; highlights?: string[]; position?: string }>;
  skills?: Array<{ name?: string; keywords?: string[] }>;
  projects?: Array<{ description?: string; highlights?: string[]; name?: string }>;
}): string {
  const parts: string[] = [
    resume.basics.name ?? '',
    resume.basics.label ?? '',
    resume.basics.summary ?? '',
  ];

  for (const job of resume.work ?? []) {
    parts.push(job.position ?? '', job.summary ?? '');
    parts.push(...(job.highlights ?? []));
  }

  for (const skill of resume.skills ?? []) {
    parts.push(skill.name ?? '', ...(skill.keywords ?? []));
  }

  for (const project of resume.projects ?? []) {
    parts.push(project.name ?? '', project.description ?? '');
    parts.push(...(project.highlights ?? []));
  }

  return parts.join(' ');
}
