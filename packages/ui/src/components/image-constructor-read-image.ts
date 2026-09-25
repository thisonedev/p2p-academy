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
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { name: file.name, url: canvas.toDataURL('image/png'), ratio };
}
