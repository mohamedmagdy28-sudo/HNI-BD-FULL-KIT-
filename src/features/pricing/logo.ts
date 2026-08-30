// Client-logo intake: reads an image file and returns a downscaled PNG data
// URL small enough to live inside the proposal in localStorage. Logos keep
// transparency (PNG) and never exceed 256px height / 1024px width.

const MAX_HEIGHT = 256;
const MAX_WIDTH = 1024;

export async function fileToLogoDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unreadable image"));
      img.src = objectUrl;
    });
    if (!img.width || !img.height) throw new Error("empty image");
    const scale = Math.min(1, MAX_HEIGHT / img.height, MAX_WIDTH / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
