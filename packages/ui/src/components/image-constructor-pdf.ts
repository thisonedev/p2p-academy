import type { ICLayout } from './image-constructor-layout.js';
import { composeLayout } from './image-constructor-render.js';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const binary = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  // String.fromCharCode(...bytes) overflows the call stack on a real PDF.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

/** A single-page PDF wrapping a PNG, one point per pixel. Not vector: whatever the
 *  PNG shows is already flattened. Shared by the canvas export below and the
 *  per-element avatar export in image-constructor-studio.tsx. */
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
  return bytesToDataUrl(await pdf.save());
}

export async function composeLayoutPdf(
  layout: ICLayout,
  sceneUrl: string | null,
  width: number,
): Promise<string> {
  return pngToPdf(await composeLayout(layout, sceneUrl, { width, format: 'png' }));
}
