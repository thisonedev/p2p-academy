/** An SVG document as a data URL, usable wherever an image address is. */
export const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** Text made safe to place between SVG or XML tags. Not enough for an attribute value. */
export const escapeXmlText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
