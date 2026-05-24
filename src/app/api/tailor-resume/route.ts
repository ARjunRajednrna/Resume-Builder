import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import pdf from 'pdf-parse';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ─── Types ────────────────────────────────────────────────────────────────────

interface JdAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
  tools: string[];
  responsibilities: string[];
  keywords: string[];
  yearsExperience: string;
  title: string;
}

const EMPTY_JD_ANALYSIS: JdAnalysis = {
  requiredSkills: [],
  preferredSkills: [],
  tools: [],
  responsibilities: [],
  keywords: [],
  yearsExperience: '',
  title: '',
};

// ─── Rate Limiter (in-memory; swap for Upstash Redis in production) ───────────

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxPerMinute = 5): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// ─── Text Utilities ───────────────────────────────────────────────────────────

function cleanResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z])- \n([a-z])/gi, '$1$2')
    .trim();
}

function parseJsonFromResponse<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonStr) as T;
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

function flattenKeywords(analysis: JdAnalysis): string[] {
  return uniqueStrings([
    ...analysis.keywords,
    ...analysis.requiredSkills,
    ...analysis.preferredSkills,
    ...analysis.tools,
    ...analysis.responsibilities,
  ]);
}

// ─── Keyword Matching (normalised + stemmed) ──────────────────────────────────

function normalizeKeyword(kw: string): string {
  return kw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .replace(/ing$|ed$|s$/i, '')   // basic stemming
    .trim();
}

function computeKeywordMatch(
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

// ─── Seniority Detection ──────────────────────────────────────────────────────

type SeniorityLevel = 'entry-level/fresher' | 'junior' | 'mid-level' | 'senior';

function detectSeniorityLevel(yearsExperience: string): SeniorityLevel {
  const text = yearsExperience.toLowerCase();
  if (
    text.includes('0') ||
    text.includes('fresher') ||
    text.includes('entry') ||
    text.includes('junior') ||
    text === '' // no experience stated — assume fresher
  ) {
    return 'entry-level/fresher';
  }
  if (text.includes('1') || text.includes('2')) return 'junior';
  if (text.includes('5') || text.includes('6') || text.includes('7')) return 'senior';
  return 'mid-level';
}

function seniorityVerbGuidance(level: SeniorityLevel): string {
  switch (level) {
    case 'entry-level/fresher':
      return 'Use entry-level verbs: "Built", "Developed", "Assisted", "Contributed to", "Implemented", "Supported", "Learned". NEVER use "Architected", "Owned", "Spearheaded", "Drove", or "Led" for this role.';
    case 'junior':
      return 'Use junior-level verbs: "Developed", "Built", "Improved", "Implemented", "Collaborated on", "Contributed to".';
    case 'mid-level':
      return 'Use mid-level verbs: "Designed", "Led", "Optimized", "Delivered", "Managed", "Refactored".';
    case 'senior':
      return 'Use senior-level verbs: "Architected", "Owned", "Drove", "Spearheaded", "Established", "Mentored".';
  }
}

function fresherGuidance(level: SeniorityLevel): string {
  if (level !== 'entry-level/fresher') return '';
  return `
FRESHER ROLE ADDITIONAL RULES:
- Use phrases like "collaborated with team", "worked alongside senior engineers", "contributed to" where truthful.
- Avoid implying sole ownership of large systems or end-to-end architecture.
- Highlight learning curve, adaptability, and eagerness to grow.
- It's fine to mention "under guidance of" or "as part of a team".`;
}

// ─── Gemini Model Factory ─────────────────────────────────────────────────────

function getFlashModel(maxOutputTokens = 8192): GenerativeModel {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens,
      temperature: 0.15,
      topP: 0.9,
    },
  });
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

async function extractJdAnalysis(
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
- Include 15-30 high-value ATS keywords/phrases in "keywords" (technologies, methodologies, role-specific terms from the JD).
- Use exact wording from the JD where possible.
- Do not include empty strings in arrays.
- For "yearsExperience": if the role says fresher/entry-level/0 years, write "fresher".

JOB DESCRIPTION:
${jobDescription}`;

  const result = await model.generateContent(extractPrompt);
  const parsed = parseJsonFromResponse<Partial<JdAnalysis>>(
    result.response.text()
  );

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

function buildTailorPrompt(
  resumeText: string,
  jobDescription: string,
  keywords: string[],
  jdAnalysis: JdAnalysis
): string {
  const keywordBlock = keywords.length > 0 ? keywords.join('\n') : 'N/A';
  const seniority = detectSeniorityLevel(jdAnalysis.yearsExperience);
  const verbGuidance = seniorityVerbGuidance(seniority);
  const fresherNotes = fresherGuidance(seniority);

  return `You are an ATS-aware resume optimizer.

GOAL: Maximize alignment with the job description while staying 100% truthful.

STRICT RULES:
1. Preserve the same sections, order, and overall layout as the original resume.
2. Do NOT invent employers, dates, degrees, certifications, or metrics.
3. You MAY rephrase bullets, reorder bullets within a section, and strengthen weak verbs.
4. Mirror exact phrases from the JD when they truthfully apply (e.g. "CI/CD", "React", "stakeholder management").
5. Every bullet in Experience/Projects should tie to at least one JD responsibility or skill when possible.
6. Add a "Core Skills" or skills line ONLY if that section already exists; do not create new sections.
7. Prefer keyword-dense but readable bullets (action verb + tool/skill + outcome/metric).
8. Output ONLY the full tailored resume text—no commentary, no markdown fences.
9. SENIORITY: The target role is ${seniority}. ${verbGuidance}
${fresherNotes}

TARGET ROLE: ${jdAnalysis.title || 'N/A'}
EXPERIENCE EXPECTED: ${jdAnalysis.yearsExperience || 'N/A'}

JD PRIORITY KEYWORDS (use where supported by resume facts):
${keywordBlock}

REQUIRED SKILLS: ${jdAnalysis.requiredSkills.join(', ') || 'N/A'}
PREFERRED SKILLS: ${jdAnalysis.preferredSkills.join(', ') || 'N/A'}
TOOLS: ${jdAnalysis.tools.join(', ') || 'N/A'}

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

TAILORED RESUME:`;
}

function buildGapFillPrompt(
  tailoredResume: string,
  jobDescription: string,
  missingKeywords: string[]
): string {
  return `Compare this tailored resume to the missing JD keywords below.
Rewrite ONLY the bullets that can honestly include missing keywords.
Do not change employers, dates, section names, or invent experience.
Output ONLY the full updated resume text—no commentary, no markdown fences.

MISSING KEYWORDS TO INCORPORATE (where truthful):
${missingKeywords.join('\n')}

CURRENT RESUME:
${tailoredResume}

JOB DESCRIPTION:
${jobDescription}

UPDATED RESUME:`;
}

function buildSkillsFormatterPrompt(tailoredResume: string): string {
  return `In the resume below, reformat ONLY the Skills section using these rules:
1. Split into clean sub-categories: "Programming Languages", "Frameworks & Tools", "Practices & Methods".
2. Do NOT list soft skills (e.g. "problem-solving", "collaboration", "communication") as raw comma-separated items — fold them naturally into experience bullet descriptions instead, or omit them from the skills section.
3. Keep only concrete, verifiable skills in the skills section (languages, frameworks, tools, methodologies).
4. Do NOT change any other section — experience, education, projects, certifications must remain identical.
5. Output ONLY the full resume text—no commentary, no markdown fences.

RESUME:
${tailoredResume}

UPDATED RESUME:`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── API key guard ──────────────────────────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // ── Rate limiting ──────────────────────────────────────────────────────────
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    // ── Parse form data ────────────────────────────────────────────────────────
    const formData = await req.formData();
    const pdfFile = formData.get('resume') as File | null;
    const jobDescription = (formData.get('jobDescription') as string)?.trim();

    // ── Input validation ───────────────────────────────────────────────────────
    if (!pdfFile || pdfFile.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Resume PDF is required' },
        { status: 400 }
      );
    }

    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are accepted' },
        { status: 400 }
      );
    }

    if (pdfFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 5MB)' },
        { status: 400 }
      );
    }

    if (!jobDescription || jobDescription.length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job description is too short (minimum 50 characters)',
        },
        { status: 400 }
      );
    }

    if (jobDescription.length > 10_000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Job description is too long (maximum 10,000 characters)',
        },
        { status: 400 }
      );
    }

    // ── Extract PDF text ───────────────────────────────────────────────────────
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const pdfData = await pdf(buffer);
    const resumeText = cleanResumeText(pdfData.text);

    if (!resumeText || resumeText.length < 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract enough text from PDF. Try a text-based PDF.',
        },
        { status: 400 }
      );
    }

    const extractModel = getFlashModel(4096);
    const tailorModel = getFlashModel(8192);

    // ── Step 1: Extract JD structure and keywords ──────────────────────────────
    let jdAnalysis: JdAnalysis;
    try {
      jdAnalysis = await extractJdAnalysis(extractModel, jobDescription);
    } catch (parseError) {
      console.error('JD extraction parse error:', parseError);
      jdAnalysis = { ...EMPTY_JD_ANALYSIS };
    }

    const keywords = flattenKeywords(jdAnalysis);
    const seniority = detectSeniorityLevel(jdAnalysis.yearsExperience);

    // ── Step 2: Tailor resume ──────────────────────────────────────────────────
    const tailorPrompt = buildTailorPrompt(
      resumeText,
      jobDescription,
      keywords,
      jdAnalysis
    );
    const tailorResult = await tailorModel.generateContent(tailorPrompt);
    let tailoredResume = tailorResult.response.text().trim();

    // ── Step 3: Gap-fill missing keywords (only if gap is small) ──────────────
    const afterTailorMatch = computeKeywordMatch(tailoredResume, keywords);
    if (
      afterTailorMatch.missing.length > 0 &&
      afterTailorMatch.missing.length <= 15
    ) {
      const gapPrompt = buildGapFillPrompt(
        tailoredResume,
        jobDescription,
        afterTailorMatch.missing
      );
      const gapResult = await tailorModel.generateContent(gapPrompt);
      tailoredResume = gapResult.response.text().trim();
    }

    // ── Step 4: Clean up skills section ───────────────────────────────────────
    const skillsResult = await tailorModel.generateContent(
      buildSkillsFormatterPrompt(tailoredResume)
    );
    tailoredResume = skillsResult.response.text().trim();

    // ── Final scoring ──────────────────────────────────────────────────────────
    const finalMatch = computeKeywordMatch(tailoredResume, keywords);
    const originalMatch = computeKeywordMatch(resumeText, keywords);

    return NextResponse.json({
      success: true,
      tailoredResume,
      meta: {
        model: {
          extract: 'gemini-2.5-flash',
          tailor: 'gemini-2.5-flash',
          gapFill: 'gemini-2.5-flash',
          skillsFormat: 'gemini-2.5-flash',
        },
        jdTitle: jdAnalysis.title,
        seniority,
        keywordsTargeted: keywords,
        matchScore: {
          before: originalMatch.score,
          after: finalMatch.score,
        },
        matchedKeywords: finalMatch.matched,
        missingKeywords: finalMatch.missing,
        jdAnalysis: {
          requiredSkills: jdAnalysis.requiredSkills,
          preferredSkills: jdAnalysis.preferredSkills,
          tools: jdAnalysis.tools,
          responsibilities: jdAnalysis.responsibilities,
        },
      },
    });
  } catch (error) {
    console.error('Unhandled error:', error);

    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('api key')) {
        return NextResponse.json(
          { success: false, error: 'AI service misconfigured' },
          { status: 500 }
        );
      }
      if (
        error.message.toLowerCase().includes('quota') ||
        error.message.toLowerCase().includes('rate')
      ) {
        return NextResponse.json(
          { success: false, error: 'AI quota exceeded. Try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to tailor resume' },
      { status: 500 }
    );
  }
}