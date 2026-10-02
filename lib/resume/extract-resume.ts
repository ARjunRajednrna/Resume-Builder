import type { GenerativeModel } from '@google/generative-ai';
import type { JsonResume } from '../../types/json-resume';
import { parseJsonFromResponse } from './gemini-utils';

const RESUME_JSON_SCHEMA = `{
  "basics": {
    "name": "Full Name",
    "label": "Job title e.g. Software Developer",
    "email": "email@example.com",
    "phone": "+91...",
    "summary": "optional professional summary paragraph",
    "location": { "city": "Mumbai", "region": "Maharashtra", "countryCode": "IN" },
    "profiles": [{ "network": "LinkedIn", "url": "https://..." }, { "network": "GitHub", "url": "https://..." }]
  },
  "work": [{
    "name": "Company name",
    "position": "Job title at company",
    "location": "City",
    "startDate": "Nov '25",
    "endDate": "Present",
    "summary": "Role description paragraph if present",
    "highlights": ["bullet achievement if present"]
  }],
  "education": [{
    "institution": "College name",
    "area": "Field of study e.g. Information Technology",
    "studyType": "Bachelor or Master",
    "startDate": "",
    "endDate": "Jul '23 or Present",
    "score": "GPA if present"
  }],
  "skills": [{
    "name": "Languages",
    "keywords": ["Python", "JavaScript"]
  }],
  "projects": [{
    "name": "Project title",
    "description": "Project description paragraph",
    "highlights": ["bullet if present"]
  }],
  "certificates": [{
    "name": "Certificate name",
    "issuer": "Issuer",
    "date": "May '26"
  }]
}`;

export async function extractResumeFromText(
  model: GenerativeModel,
  resumeText: string
): Promise<JsonResume> {
  const prompt = `Extract this resume into structured JSON Resume format.
Return valid JSON ONLY (no markdown, no commentary). Match this schema exactly:
${RESUME_JSON_SCHEMA}

Rules:
1. Preserve ALL content — do not omit sections, jobs, education, projects, skills, or certifications.
2. Put paragraph-style job descriptions in work[].summary; put bullet points in work[].highlights.
3. Group skills by category (Languages, Tools, Frameworks, etc.) matching the original labels.
4. For education, combine degree type into studyType and field into area when separate in source.
5. Use exact dates, names, emails, phone numbers, GPAs, and metrics from the source.
6. If a section is missing in the source, use an empty array [] — do not invent content.
7. basics.name and basics.email are required.

RESUME TEXT:
${resumeText}`;

  const result = await model.generateContent(prompt);
  const parsed = parseJsonFromResponse<JsonResume>(result.response.text());
  return normalizeResume(parsed);
}

export function normalizeResume(data: JsonResume): JsonResume {
  return {
    basics: {
      name: data.basics?.name?.trim() ?? '',
      label: data.basics?.label?.trim(),
      email: data.basics?.email?.trim() ?? '',
      phone: data.basics?.phone?.trim(),
      url: data.basics?.url?.trim(),
      summary: data.basics?.summary?.trim(),
      location: data.basics?.location,
      profiles: data.basics?.profiles ?? [],
    },
    work: (data.work ?? []).map((job) => ({
      name: job.name?.trim() ?? '',
      position: job.position?.trim(),
      location: job.location?.trim(),
      startDate: job.startDate?.trim(),
      endDate: job.endDate?.trim(),
      summary: job.summary?.trim(),
      highlights: (job.highlights ?? []).map((h) => h.trim()).filter(Boolean),
    })),
    education: (data.education ?? []).map((edu) => ({
      institution: edu.institution?.trim() ?? '',
      area: edu.area?.trim(),
      studyType: edu.studyType?.trim(),
      startDate: edu.startDate?.trim(),
      endDate: edu.endDate?.trim(),
      score: edu.score?.trim(),
    })),
    skills: (data.skills ?? []).map((skill) => ({
      name: skill.name?.trim() ?? 'Skills',
      keywords: (skill.keywords ?? []).map((k) => k.trim()).filter(Boolean),
    })),
    projects: (data.projects ?? []).map((project) => ({
      name: project.name?.trim() ?? '',
      description: project.description?.trim(),
      highlights: (project.highlights ?? []).map((h) => h.trim()).filter(Boolean),
    })),
    certificates: (data.certificates ?? []).map((cert) => ({
      name: cert.name?.trim() ?? '',
      issuer: cert.issuer?.trim(),
      date: cert.date?.trim(),
    })),
  };
}

export function validateExtractedResume(resume: JsonResume): string | null {
  if (!resume.basics.name) return 'Could not extract your name from the resume.';
  if (!resume.basics.email) return 'Could not extract your email from the resume.';
  const hasContent =
    (resume.work?.length ?? 0) > 0 ||
    (resume.education?.length ?? 0) > 0 ||
    (resume.skills?.length ?? 0) > 0;
  if (!hasContent) {
    return 'Could not extract enough resume content. Try a text-based PDF.';
  }
  return null;
}
