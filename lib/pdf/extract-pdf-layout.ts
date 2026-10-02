import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { matchSectionHeader } from '../resume/section-parser';

export interface PdfTextLine {
  id: number;
  text: string;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  fontSize: number;
  pageIndex: number;
  sectionKey: string;
  editable: boolean;
}

export interface PdfLineLayout {
  pageWidth: number;
  pageHeight: number;
  numPages: number;
  lines: PdfTextLine[];
}

const Y_TOLERANCE = 3;
const PAGE_MARGIN = 40;

export async function extractPdfLines(buffer: Buffer): Promise<PdfLineLayout> {
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const rawItems: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    pageIndex: number;
    width: number;
  }> = [];

  let pageWidth = 612;
  let pageHeight = 792;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageWidth = viewport.width;
    pageHeight = viewport.height;

    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const tx = item.transform;
      const fontSize = Math.abs(tx[0]) || Math.abs(tx[3]) || 12;
      rawItems.push({
        text: item.str,
        x: tx[4],
        y: tx[5],
        fontSize,
        pageIndex: pageNum - 1,
        width: item.width ?? fontSize * item.str.length * 0.5,
      });
    }
  }

  const grouped = groupRawItemsIntoLines(rawItems);
  const lines = assignSectionsAndEditability(grouped, pageWidth);

  return {
    pageWidth,
    pageHeight,
    numPages: doc.numPages,
    lines,
  };
}

interface GroupedLine {
  text: string;
  y: number;
  pageIndex: number;
  fontSize: number;
  minX: number;
  maxX: number;
}

function groupRawItemsIntoLines(
  items: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    pageIndex: number;
    width: number;
  }>
): GroupedLine[] {
  const lineMap = new Map<string, typeof items>();

  for (const item of items) {
    const key = `${item.pageIndex}:${Math.round(item.y / Y_TOLERANCE) * Y_TOLERANCE}`;
    const group = lineMap.get(key) ?? [];
    group.push(item);
    lineMap.set(key, group);
  }

  const lines: GroupedLine[] = [];
  for (const group of lineMap.values()) {
    group.sort((a, b) => a.x - b.x);
    const y = group.reduce((sum, i) => sum + i.y, 0) / group.length;
    const fontSize =
      group.reduce((sum, i) => sum + i.fontSize, 0) / group.length;
    lines.push({
      text: group.map((i) => i.text).join('').trim(),
      y,
      pageIndex: group[0].pageIndex,
      fontSize,
      minX: Math.min(...group.map((i) => i.x)),
      maxX: Math.max(...group.map((i) => i.x + i.width)),
    });
  }

  return lines.sort((a, b) => {
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return b.y - a.y;
  });
}

function assignSectionsAndEditability(
  grouped: GroupedLine[],
  pageWidth: number
): PdfTextLine[] {
  let currentSection = 'HEADER';
  const rightBound = pageWidth - PAGE_MARGIN;

  return grouped
    .filter((line) => line.text.length > 0)
    .map((line, index) => {
      const headerKey = matchSectionHeader(line.text);
      if (headerKey) {
        currentSection = headerKey;
      }

      const editable =
        !headerKey && isLineEditable(line.text, currentSection);

      return {
        id: index,
        text: line.text,
        x: line.minX,
        y: line.y,
        minX: line.minX,
        maxX: Math.max(line.maxX, rightBound),
        fontSize: line.fontSize,
        pageIndex: line.pageIndex,
        sectionKey: headerKey ?? currentSection,
        editable,
      };
    });
}

function isLineEditable(text: string, sectionKey: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (
    sectionKey === 'HEADER' ||
    sectionKey === 'EDUCATION' ||
    sectionKey === 'CERTIFICATIONS'
  ) {
    return false;
  }

  if (sectionKey === 'SKILLS') {
    return /^(Languages|Tools|Framework|Methodologies|Practices)/i.test(t);
  }

  if (sectionKey === 'PROJECTS') {
    // Short project titles (no bullet, not a description starter) stay fixed
    const isDescriptionLine =
      /^[•\-\*]/.test(t) ||
      /^(created|achieving|technologies|user|utilized|improved|built|developed)/i.test(t) ||
      /^[\d(]/.test(t) ||
      /^[a-z]/.test(t) ||
      t.length >= 55;
    if (!isDescriptionLine) return false;
    return true;
  }

  if (sectionKey === 'EXPERIENCE') {
    if (/\d{4}|Present|—|–|' \d{2}/.test(t) && t.length < 55) return false;
    if (t.includes('@') || /\+\d{10}/.test(t.replace(/\s/g, ''))) return false;
    if (t.length >= 50) return true;
    return false;
  }

  if (sectionKey === 'SUMMARY') {
    return t.length >= 40;
  }

  return false;
}

export function getEditableLines(lines: PdfTextLine[]): PdfTextLine[] {
  return lines.filter((l) => l.editable);
}

export function findNextLineOnPage(
  lines: PdfTextLine[],
  current: PdfTextLine
): PdfTextLine | null {
  const pageLines = lines
    .filter((l) => l.pageIndex === current.pageIndex && l.y < current.y - 1)
    .sort((a, b) => b.y - a.y);
  return pageLines[0] ?? null;
}
