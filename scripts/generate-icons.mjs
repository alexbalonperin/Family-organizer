// Render the app icon SVG into the PNGs Next.js conventions and the PWA
// manifest expect. Re-run after editing app/icon.svg:
//
//   pnpm icons
//
// Outputs:
//   app/apple-icon.png            180x180  — iOS home-screen
//   public/icons/icon-192.png     192x192  — manifest
//   public/icons/icon-512.png     512x512  — manifest
//   public/icons/icon-maskable.png 512x512 — manifest, with extra safe-area padding
//
// app/icon.svg itself is the browser favicon (Next picks it up automatically).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

async function ensureDir(file) {
  await mkdir(dirname(file), { recursive: true });
}

async function renderTo(svg, outPath, size) {
  await ensureDir(outPath);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath} (${size}×${size})`);
}

const baseSvg = await readFile(resolve(root, "app/icon.svg"));

// Maskable: same shape, but the checkmark sits inside the inner 60% so the
// outer 20% safe-area can be cropped by the OS without losing the glyph.
// Background extends to all four edges (no rounded rect).
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0ea5e9"/>
  <path d="M 175 256 L 235 316 L 337 214"
        fill="none" stroke="#ffffff" stroke-width="42"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);

await renderTo(baseSvg, resolve(root, "app/apple-icon.png"), 180);
await renderTo(baseSvg, resolve(root, "public/icons/icon-192.png"), 192);
await renderTo(baseSvg, resolve(root, "public/icons/icon-512.png"), 512);
await renderTo(maskableSvg, resolve(root, "public/icons/icon-maskable.png"), 512);
