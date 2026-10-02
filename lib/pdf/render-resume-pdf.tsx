import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import pdfParse from 'pdf-parse';
import type { JsonResume } from '../../types/json-resume';
import { ResumeDocument } from './resume-document';

export async function renderResumePdf(resume: JsonResume): Promise<Buffer> {
  const buffer = await renderToBuffer(<ResumeDocument resume={resume} />);
  return Buffer.from(buffer);
}

export async function validatePdfStructure(
  pdfBuffer: Buffer,
  expectedName: string
): Promise<boolean> {
  const parsed = await pdfParse(pdfBuffer);
  const text = parsed.text.toLowerCase();
  const name = expectedName.toLowerCase().trim();

  if (!name || !text.includes(name)) return false;

  const sectionMarkers = ['experience', 'education', 'skills'];
  const foundSections = sectionMarkers.filter((s) => text.includes(s));
  return foundSections.length >= 2;
}
