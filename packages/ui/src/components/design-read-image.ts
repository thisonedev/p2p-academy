/** Reads an image file as a data URL, scaled down so its longer side is at most `maxSide`. */
export async function readImage(file: File, maxSide: number): Promise<{ name: string; url: string; ratio: number }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That file is not an image.'));
    el.src = raw;
  });
  const ratio = img.naturalWidth / img.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1) return { name: file.name, url: raw, ratio };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  // A photo with no see-through pixels is far smaller as JPEG; anything transparent stays PNG.
  const opaque = ctx ? isOpaque(ctx.getImageData(0, 0, canvas.width, canvas.height).data) : false;
  return {
    name: file.name,
    url: opaque ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png'),
    ratio,
  };
}

function isOpaque(pixels: Uint8ClampedArray): boolean {
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 255) return false;
  return true;
}
