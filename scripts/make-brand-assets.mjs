import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");

const HIGH = 248;
const LOW = 200;

const stripWhite = async (input, output, size, fit = "cover") => {
  const { data, info } = await sharp(input)
    .resize(size, size, { fit })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    let alpha;
    if (luminance >= HIGH) {
      alpha = 0;
    } else if (luminance <= LOW) {
      alpha = 255;
    } else {
      alpha = Math.round(((HIGH - luminance) / (HIGH - LOW)) * 255);
    }

    if (alpha === 0) {
      pixels[index] = 0;
      pixels[index + 1] = 0;
      pixels[index + 2] = 0;
      pixels[index + 3] = 0;
      continue;
    }

    if (alpha < 255) {
      const ratio = alpha / 255;
      pixels[index] = Math.round((r - 255 * (1 - ratio)) / ratio);
      pixels[index + 1] = Math.round((g - 255 * (1 - ratio)) / ratio);
      pixels[index + 2] = Math.round((b - 255 * (1 - ratio)) / ratio);
    }

    pixels[index + 3] = alpha;
  }

  await sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(output);
};

const markSource = path.join(brandDir, "idb.jpg");
const markTarget = path.join(brandDir, "idb.png");
const appleTarget = path.join(brandDir, "apple-touch-icon.png");

await stripWhite(markSource, markTarget, 512);
await sharp(markTarget).resize(180, 180).png().toFile(appleTarget);

console.log("Selesai:");
console.log("- public/brand/idb.png (512px, latar transparan)");
console.log("- public/brand/apple-touch-icon.png (180px)");
console.log("Catatan: idb-logo.png sudah transparan sejak awal, tidak perlu diproses.");
