import sharp from "sharp";
import { statSync } from "fs";
import { join } from "path";

const imgDir = "public/images";

for (let i = 1; i <= 20; i++) {
  const num = String(i).padStart(2, "0");
  const src = join(imgDir, `page-${num}.jpg`);
  const dst = join(imgDir, `page-${num}.webp`);
  await sharp(src).webp({ quality: 82 }).toFile(dst);
  const origKb = Math.round(statSync(src).size / 1024);
  const newKb  = Math.round(statSync(dst).size / 1024);
  console.log(`page-${num}: ${origKb}KB -> ${newKb}KB`);
}
console.log("All done!");
