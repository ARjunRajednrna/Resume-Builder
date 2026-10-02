import type { GenerativeModel } from '@google/generative-ai';
import { parseJsonFromResponse } from './gemini-utils';

export interface JdAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  keywords: string[];
  yearsExperience: string;
  title: string;
}

export const EMPTY_JD_ANALYSIS: JdAnalysis = {
  requiredSkills: [],
  preferredSkills: [],
  tools: [],
  responsibilities: [],
  keywords: [],
  yearsExperience: '',
  title: '',
};

export function flattenKeywords(analysis: JdAnalysis): string[] {
  return uniqueStrings([
    ...analysis.keywords,
    ...analysis.requiredSkills,
    ...analysis.preferredSkills,
    ...analysis.tools,
    ...analysis.responsibilities,
  ]);
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export async function extractJdAnalysis(
  model: GenerativeModel,
  jobDescription: string
): Promise<JdAnalysis> {
  const extractPrompt = `From this job description, extract hiring requirements.
Return valid JSON only (no markdown, no commentary) matching this schema:
{
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1"],
  "tools": ["tool1", "tool2"],
  "responsibilities": ["responsibility1"],
  "keywords": ["important ATS keyword phrases"],
  "yearsExperience": "e.g. 3+ years or fresher or 0-1 years",
  "title": "job title"
}

Rules:
- Include 15-30 high-value ATS keywords/phrases in "keywords".
- Use exact wording from the JD where possible.
- Do not include empty strings in arrays.

JOB DESCRIPTION:
${jobDescription}`;

  const result = await model.generateContent(extractPrompt);
  const parsed = parseJsonFromResponse<Partial<JdAnalysis>>(result.response.text());

  return {
    requiredSkills: parsed.requiredSkills ?? [],
    preferredSkills: parsed.preferredSkills ?? [],
    tools: parsed.tools ?? [],
    responsibilities: parsed.responsibilities ?? [],
    keywords: parsed.keywords ?? [],
    yearsExperience: parsed.yearsExperience ?? '',
    title: parsed.title ?? '',
  };
}

export type SeniorityLevel =
  | 'entry-level/fresher'
  | 'junior'
  | 'mid-level'
  | 'senior';

export function detectSeniorityLevel(yearsExperience: string): SeniorityLevel {
  const text = yearsExperience.toLowerCase();
  if (
    text.includes('0') ||
    text.includes('fresher') ||
    text.includes('entry') ||
    text.includes('junior') ||
    text === ''
  ) {
    return 'entry-level/fresher';
  }
  if (text.includes('1') || text.includes('2')) return 'junior';
  if (text.includes('5') || text.includes('6') || text.includes('7')) {
    return 'senior';
  }
  return 'mid-level';
}

export function seniorityVerbGuidance(level: SeniorityLevel): string {
  switch (level) {
    case 'entry-level/fresher':
      return 'Use entry-level verbs: "Built", "Developed", "Assisted", "Contributed to", "Implemented". NEVER use "Architected", "Owned", or "Spearheaded".';
    case 'junior':
      return 'Use junior-level verbs: "Developed", "Built", "Improved", "Implemented", "Collaborated on".';
    case 'mid-level':
      return 'Use mid-level verbs: "Designed", "Led", "Optimized", "Delivered", "Managed".';
    case 'senior':
      return 'Use senior-level verbs: "Architected", "Owned", "Drove", "Spearheaded", "Mentored".';
  }
}
