import type { GenerativeModel } from '@google/generative-ai';
import type { JsonResume } from '../../types/json-resume';
import {
  detectSeniorityLevel,
  seniorityVerbGuidance,
  type JdAnalysis,
} from './jd-analysis';
import { parseJsonFromResponse } from './gemini-utils';
import { normalizeResume } from './extract-resume';

export async function tailorResumeData(
  model: GenerativeModel,
  resume: JsonResume,
  jobDescription: string,
  jdAnalysis: JdAnalysis,
  keywords: string[]
): Promise<JsonResume> {
  const seniority = detectSeniorityLevel(jdAnalysis.yearsExperience);
  const verbGuidance = seniorityVerbGuidance(seniority);
  const keywordBlock = keywords.length > 0 ? keywords.join('\n') : 'N/A';

  const prompt = `You are an ATS-aware resume optimizer. Tailor the resume JSON to better match the job description.

Return valid JSON ONLY (no markdown) — the FULL resume object with the same schema, not a diff.

STRICT RULES:
1. DO NOT change: basics.name, basics.email, basics.phone, basics.location, basics.profiles, work[].name, work[].startDate, work[].endDate, work[].position, education (all fields), certificates (all fields), project names.
2. DO tailor: work[].summary, work[].highlights, projects[].description, projects[].highlights, skills[].keywords, basics.summary (if present).
3. DO NOT invent employers, dates, degrees, certifications, projects, or metrics.
4. Mirror JD keywords only where truthfully supported by original content.
5. Prefer minimal rephrasing. Keep similar length to originals.
6. SENIORITY: Target role is ${seniority}. ${verbGuidance}
7. Keep skills grouped by the same category names (Languages, Tools, Frameworks, etc.).
8. Add JD-relevant tools/skills to skills[].keywords only if the candidate plausibly has them based on the original resume.

TARGET ROLE: ${jdAnalysis.title || 'N/A'}
EXPERIENCE EXPECTED: ${jdAnalysis.yearsExperience || 'N/A'}

JD PRIORITY KEYWORDS:
${keywordBlock}

REQUIRED SKILLS: ${jdAnalysis.requiredSkills.join(', ') || 'N/A'}
PREFERRED SKILLS: ${jdAnalysis.preferredSkills.join(', ') || 'N/A'}
TOOLS: ${jdAnalysis.tools.join(', ') || 'N/A'}

CURRENT RESUME JSON:
${JSON.stringify(resume, null, 2)}

JOB DESCRIPTION:
${jobDescription}

Return the tailored resume JSON:`;

  const result = await model.generateContent(prompt);
  const parsed = parseJsonFromResponse<JsonResume>(result.response.text());
  const normalized = normalizeResume(parsed);

  return preserveLockedFields(resume, normalized);
}

export async function gapFillResumeData(
  model: GenerativeModel,
  resume: JsonResume,
  missingKeywords: string[],
  jobDescription: string
): Promise<JsonResume> {
  if (missingKeywords.length === 0) return resume;

  const prompt = `Some JD keywords are still missing from this resume JSON. Update ONLY work summaries/highlights, project descriptions/highlights, and skills keywords where keywords can be added truthfully.

Return valid JSON ONLY — the FULL resume object.

DO NOT change: name, email, phone, dates, company names, education, certificate names, project names.

MISSING KEYWORDS:
${missingKeywords.join('\n')}

CURRENT RESUME JSON:
${JSON.stringify(resume, null, 2)}

JOB DESCRIPTION:
${jobDescription}

Return the updated resume JSON:`;

  const result = await model.generateContent(prompt);
  const parsed = parseJsonFromResponse<JsonResume>(result.response.text());
  const normalized = normalizeResume(parsed);
  return preserveLockedFields(resume, normalized);
}

function preserveLockedFields(
  original: JsonResume,
  tailored: JsonResume
): JsonResume {
  return {
    ...tailored,
    basics: {
      ...tailored.basics,
      name: original.basics.name,
      email: original.basics.email,
      phone: original.basics.phone ?? tailored.basics.phone,
      location: original.basics.location ?? tailored.basics.location,
      profiles: original.basics.profiles?.length
        ? original.basics.profiles
        : tailored.basics.profiles,
    },
    work: (tailored.work ?? []).map((job, i) => {
      const orig = original.work?.[i];
      if (!orig) return job;
      return {
        ...job,
        name: orig.name,
        position: orig.position ?? job.position,
        startDate: orig.startDate ?? job.startDate,
        endDate: orig.endDate ?? job.endDate,
        location: orig.location ?? job.location,
      };
    }),
    education: original.education ?? tailored.education,
    certificates: original.certificates ?? tailored.certificates,
    projects: (tailored.projects ?? []).map((project, i) => ({
      ...project,
      name: original.projects?.[i]?.name ?? project.name,
    })),
  };
}
