import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import {
  extractPdfLines,
  findNextLineOnPage,
  type PdfTextLine,
} from './extract-pdf-layout';
import { renderPageToPng } from './render-page-to-image';
import type { LineEdit } from '../resume/line-edits';
import { normalizeLineText } from '../resume/line-edits';

export async function applyLineEditsToPdf(
  originalBuffer: Buffer,
  lines: PdfTextLine[],
  edits: LineEdit[],
  pageWidth = 612
): Promise<Buffer> {
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  const activeEdits = edits.filter((edit) => {
    const line = lineMap.get(edit.id);
    if (!line || !line.editable) return false;
    return normalizeLineText(line.text) !== normalizeLineText(edit.text);
  });

  if (activeEdits.length === 0) {
    return originalBuffer;
  }

  const sourceDoc = await PDFDocument.load(originalBuffer);
  const newDoc = await PDFDocument.create();
  const font = await newDoc.embedFont(StandardFonts.Helvetica);

  const editsByPage = new Map<number, LineEdit[]>();
  for (const edit of activeEdits) {
    const line = lineMap.get(edit.id)!;
    const pageEdits = editsByPage.get(line.pageIndex) ?? [];
    pageEdits.push(edit);
    editsByPage.set(line.pageIndex, pageEdits);
  }

  const pageCount = sourceDoc.getPageCount();

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageEdits = editsByPage.get(pageIndex);

    if (!pageEdits || pageEdits.length === 0) {
      const [copied] = await newDoc.copyPages(sourceDoc, [pageIndex]);
      newDoc.addPage(copied);
      continue;
    }

    // Flatten page to image — removes all original vector text (no overlap)
    const { png, pdfWidth, pdfHeight } = await renderPageToPng(
      originalBuffer,
      pageIndex,
      2
    );

    const page = newDoc.addPage([pdfWidth, pdfHeight]);
    const image = await newDoc.embedPng(png);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: pdfWidth,
      height: pdfHeight,
    });

    const sortedEdits = [...pageEdits].sort((a, b) => {
      const lineA = lineMap.get(a.id);
      const lineB = lineMap.get(b.id);
      return (lineA?.y ?? 0) - (lineB?.y ?? 0);
    });

    for (const edit of sortedEdits) {
      const line = lineMap.get(edit.id);
      if (!line) continue;
      replaceLineText(page, line, edit.text, lines, font, pdfWidth || pageWidth);
    }
  }

  return Buffer.from(await newDoc.save());
}

function replaceLineText(
  page: ReturnType<PDFDocument['getPages']>[number],
  line: PdfTextLine,
  newText: string,
  allLines: PdfTextLine[],
  font: PDFFont,
  pageWidth: number
) {
  const nextLine = findNextLineOnPage(allLines, line);
  const lineHeight = line.fontSize * 1.35;
  const topY = line.y + line.fontSize * 0.55;
  let bottomY = line.y - lineHeight + line.fontSize * 0.1;

  if (nextLine && nextLine.y < line.y - 1) {
    bottomY = Math.max(bottomY, nextLine.y + nextLine.fontSize * 0.55);
  }

  const leftX = Math.max(0, line.minX - 3);
  const maxWidth = pageWidth - leftX - 40;

  // Erase old text from the flattened page image
  page.drawRectangle({
    x: leftX,
    y: bottomY,
    width: maxWidth + 6,
    height: topY - bottomY,
    color: rgb(1, 1, 1),
  });

  let fontSize = line.fontSize;
  let wrapped = wrapText(newText, font, fontSize, maxWidth);
  const wrappedLineHeight = fontSize * 1.2;
  const availableHeight = line.y - bottomY + line.fontSize * 0.3;

  if (wrapped.length * wrappedLineHeight > availableHeight && wrapped.length > 0) {
    const scale = availableHeight / (wrapped.length * wrappedLineHeight);
    fontSize = Math.max(line.fontSize * 0.72, fontSize * scale);
    wrapped = wrapText(newText, font, fontSize, maxWidth);
  }

  let y = line.y;
  for (const textLine of wrapped) {
    if (y < bottomY) break;
    page.drawText(textLine, {
      x: line.minX,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    y -= wrappedLineHeight;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const result: string[] = [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && current) {
      result.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

export async function applyLineEditsToPdfSafe(
  originalBuffer: Buffer,
  lines: PdfTextLine[],
  edits: LineEdit[],
  pageWidth = 612
): Promise<Buffer> {
  try {
    return await applyLineEditsToPdf(originalBuffer, lines, edits, pageWidth);
  } catch (error) {
    console.error('Line-level PDF edit failed, returning original:', error);
    return originalBuffer;
  }
}

export { extractPdfLines, getEditableLines } from './extract-pdf-layout';
export type { PdfTextLine } from './extract-pdf-layout';
