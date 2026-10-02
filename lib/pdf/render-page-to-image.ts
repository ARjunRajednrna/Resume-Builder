import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

export interface RenderedPage {
  png: Buffer;
  pdfWidth: number;
  pdfHeight: number;
}

export async function renderPageToPng(
  pdfBuffer: Buffer,
  pageIndex: number,
  scale = 2
): Promise<RenderedPage> {
  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(pageIndex + 1);

  const pdfViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale });

  const canvas = createCanvas(renderViewport.width, renderViewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport: renderViewport,
  }).promise;

  return {
    png: canvas.toBuffer('image/png'),
    pdfWidth: pdfViewport.width,
    pdfHeight: pdfViewport.height,
  };
}
