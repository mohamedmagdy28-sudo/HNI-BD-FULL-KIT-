// Client-logo intake: reads an image file, trims the padding baked into the
// file (transparent borders, or near-white borders on opaque files), and
// returns a downscaled PNG data URL small enough to live inside the proposal
// in localStorage. Trimming is what makes the cover's proportion box honest:
// without it, a logo with generous padding renders visibly smaller than the
// HNI logo despite an identical box.

const MAX_HEIGHT = 256;
const MAX_WIDTH = 1024;
/** Very large sources are pre-capped before pixel scanning to bound memory. */
const SCAN_CAP = 2048;

type Box = { x: number; y: number; w: number; h: number };

function contentBox(ctx: CanvasRenderingContext2D, w: number, h: number): Box {
  const data = ctx.getImageData(0, 0, w, h).data;

  // Alpha-based trim when the image has transparency (keeps white-on-transparent
  // logos intact); near-white trim for fully opaque files (JPG on white).
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  const isBackground = (i: number) =>
    hasAlpha ? data[i + 3] <= 8 : data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isBackground((y * w + x) * 4)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // Nothing detected (e.g. an all-white image): keep the full frame.
  if (maxX < 0) return { x: 0, y: 0, w, h };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

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

    // Pass 1: draw (capped) and find the actual artwork's bounding box.
    const capScale = Math.min(1, SCAN_CAP / img.width, SCAN_CAP / img.height);
    const sw = Math.max(1, Math.round(img.width * capScale));
    const sh = Math.max(1, Math.round(img.height * capScale));
    const scan = document.createElement("canvas");
    scan.width = sw;
    scan.height = sh;
    const scanCtx = scan.getContext("2d", { willReadFrequently: true });
    if (!scanCtx) throw new Error("canvas unavailable");
    scanCtx.drawImage(img, 0, 0, sw, sh);
    const box = contentBox(scanCtx, sw, sh);

    // Pass 2: crop to content and downscale to the storage bounds.
    const outScale = Math.min(1, MAX_HEIGHT / box.h, MAX_WIDTH / box.w);
    const ow = Math.max(1, Math.round(box.w * outScale));
    const oh = Math.max(1, Math.round(box.h * outScale));
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("canvas unavailable");
    outCtx.drawImage(scan, box.x, box.y, box.w, box.h, 0, 0, ow, oh);
    return out.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
