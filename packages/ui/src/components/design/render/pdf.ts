import type { ICLayout } from './layout.js';
import { composeLayout } from './render.js';
import { bytesToDataUrl, dataUrlToBytes } from '../../../lib/bytes.js';

/** A single-page PDF wrapping a PNG, one point per pixel. Not vector: whatever the
 *  PNG shows is already flattened. Shared by the canvas export below and the
 *  per-element avatar export in design/studio/studio.tsx. */
export async function pngToPdf(pngDataUrl: string): Promise<string> {
  return pngsToPdf([pngDataUrl]);
}

/** One PDF with a page per PNG, each page the size of its picture. */
export async function pngsToPdf(pngDataUrls: string[]): Promise<string> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const url of pngDataUrls) {
    const png = await pdf.embedPng(dataUrlToBytes(url));
    const page = pdf.addPage([png.width, png.height]);
    page.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
  }
  return bytesToDataUrl(await pdf.save(), 'application/pdf');
}

export async function composeLayoutPdf(
  layout: ICLayout,
  sceneUrl: string | null,
  width: number,
): Promise<string> {
  return pngToPdf(await composeLayout(layout, sceneUrl, { width, format: 'png' }));
}
