import sharp from "sharp";
import { statSync, existsSync } from "fs";
import { join } from "path";

const imgDir = "public/images";

for (let i = 1; i <= 24; i++) {
  const num = String(i).padStart(3, "0");
  const src = join(imgDir, `frame_${num}.jpg`);
  const dst = join(imgDir, `frame_${num}.webp`);
  if (existsSync(src)) {
    await sharp(src).webp({ quality: 82 }).toFile(dst);
    const origKb = Math.round(statSync(src).size / 1024);
    const newKb = Math.round(statSync(dst).size / 1024);
    console.log(`frame_${num}: ${origKb}KB -> ${newKb}KB`);
  } else {
    console.warn(`File not found: ${src}`);
  }
}
console.log("All frames converted successfully!");
