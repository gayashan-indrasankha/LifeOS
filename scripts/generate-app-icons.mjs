import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const desktopSvg = await readFile(path.join(root, 'desktop', 'icon.svg'));
const mobileSvg = await readFile(path.join(root, 'android', 'icon.svg'));

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(
  icoSizes.map((size) => sharp(desktopSvg).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + pngs.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
for (const [index, png] of pngs.entries()) {
  const entry = 6 + index * 16;
  header.writeUInt8(icoSizes[index] === 256 ? 0 : icoSizes[index], entry);
  header.writeUInt8(icoSizes[index] === 256 ? 0 : icoSizes[index], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
}
await writeFile(path.join(root, 'desktop', 'icon.ico'), Buffer.concat([header, ...pngs]));

for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const directory = path.join(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  await mkdir(directory, { recursive: true });
  await sharp(mobileSvg).resize(size, size).png().toFile(path.join(directory, 'lifeos_icon.png'));
}

console.log('Generated the Windows ICO and Android launcher icons.');
