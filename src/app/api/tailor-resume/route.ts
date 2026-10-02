import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { getFlashModel } from '../../../../lib/resume/gemini-utils';
import {
  extractJdAnalysis,
  flattenKeywords,
  EMPTY_JD_ANALYSIS,
} from '../../../../lib/resume/jd-analysis';
import {
  extractResumeFromText,
  validateExtractedResume,
} from '../../../../lib/resume/extract-resume';
import {
  tailorResumeData,
  gapFillResumeData,
} from '../../../../lib/resume/tailor-resume-data';
import {
  computeKeywordMatch,
  resumeToSearchText,
} from '../../../../lib/resume/keyword-match';
import {
  renderResumePdf,
  validatePdfStructure,
} from '../../../../lib/pdf/render-resume-pdf';

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

function cleanResumeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z])- \n([a-z])/gi, '$1$2')
    .trim();
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const pdfFile = formData.get('resume') as File | null;
    const jobDescription = (formData.get('jobDescription') as string)?.trim();

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

    const extractModel = getFlashModel(8192);
    const tailorModel = getFlashModel(8192);

    // Step 1: Extract JD keywords
    let jdAnalysis = EMPTY_JD_ANALYSIS;
    try {
      jdAnalysis = await extractJdAnalysis(extractModel, jobDescription);
    } catch (parseError) {
      console.error('JD extraction parse error:', parseError);
    }

    const keywords = flattenKeywords(jdAnalysis);

    // Step 2: Extract resume into structured JSON
    let resumeJson;
    try {
      resumeJson = await extractResumeFromText(extractModel, resumeText);
    } catch (extractError) {
      console.error('Resume extraction error:', extractError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse resume structure. Try a clearer text-based PDF.',
        },
        { status: 400 }
      );
    }

    const validationError = validateExtractedResume(resumeJson);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const originalMatch = computeKeywordMatch(resumeText, keywords);

    // Step 3: Tailor JSON content
    let tailoredResume = resumeJson;
    try {
      tailoredResume = await tailorResumeData(
        tailorModel,
        resumeJson,
        jobDescription,
        jdAnalysis,
        keywords
      );
    } catch (tailorError) {
      console.error('Resume tailoring error:', tailorError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to tailor resume content. Please try again.',
        },
        { status: 500 }
      );
    }

    // Step 4: Gap-fill if needed
    const afterTailorText = resumeToSearchText(tailoredResume);
    const afterTailorMatch = computeKeywordMatch(afterTailorText, keywords);

    if (
      afterTailorMatch.missing.length > 0 &&
      afterTailorMatch.missing.length <= 15
    ) {
      try {
        tailoredResume = await gapFillResumeData(
          tailorModel,
          tailoredResume,
          afterTailorMatch.missing,
          jobDescription
        );
      } catch (gapError) {
        console.error('Gap-fill error:', gapError);
      }
    }

    const finalMatch = computeKeywordMatch(
      resumeToSearchText(tailoredResume),
      keywords
    );

    // Step 5: Render PDF from template
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderResumePdf(tailoredResume);
    } catch (renderError) {
      console.error('PDF render error:', renderError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate PDF. Please try again.' },
        { status: 500 }
      );
    }

    const structureOk = await validatePdfStructure(
      pdfBuffer,
      tailoredResume.basics.name
    );
    if (!structureOk) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generated PDF failed structure validation. Please try again.',
        },
        { status: 500 }
      );
    }

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tailored-resume-${Date.now()}.pdf"`,
        'X-Match-Score-Before': String(originalMatch.score),
        'X-Match-Score-After': String(finalMatch.score),
      },
    });
  } catch (error) {
    console.error('Tailor resume error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to tailor resume. Please try again.' },
      { status: 500 }
    );
  }
}
