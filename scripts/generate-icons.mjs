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

// Maskable: same broom shape, scaled to ~60% so the outer 20% safe-area
// can be cropped by the OS without clipping the broom. Background extends
// to all four edges (no rounded rect).
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0ea5e9"/>
  <g transform="translate(256 256) scale(0.62) translate(-256 -256) rotate(-25 256 256)">
    <rect x="236" y="80" width="40" height="240" rx="20" fill="#ffffff"/>
    <path d="M 200 320 L 312 320 L 360 432 L 152 432 Z" fill="#ffffff"/>
    <line x1="170" y1="376" x2="342" y2="376" stroke="#0ea5e9" stroke-width="8" stroke-linecap="round"/>
    <g stroke="#0ea5e9" stroke-width="6" stroke-linecap="round">
      <line x1="200" y1="382" x2="180" y2="426"/>
      <line x1="232" y1="382" x2="220" y2="426"/>
      <line x1="256" y1="382" x2="256" y2="426"/>
      <line x1="280" y1="382" x2="292" y2="426"/>
      <line x1="312" y1="382" x2="332" y2="426"/>
    </g>
  </g>
</svg>`);

await renderTo(baseSvg, resolve(root, "app/apple-icon.png"), 180);
await renderTo(baseSvg, resolve(root, "public/icons/icon-192.png"), 192);
await renderTo(baseSvg, resolve(root, "public/icons/icon-512.png"), 512);
await renderTo(maskableSvg, resolve(root, "public/icons/icon-maskable.png"), 512);
