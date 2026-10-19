// Renders the FormaFit mark (src/app/icon.svg) to the PNG icons used by the web app
// manifest and iOS. Run: node scripts/generate-icons.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(path.join(root, "src/app/icon.svg"), "utf8");
const mark = svg.replace(/<rect[^>]*\/>/, ""); // logo strokes without the rounded square

const targets = [
  { file: "public/icon-192.png", size: 192, maskable: false },
  { file: "public/icon-512.png", size: 512, maskable: false },
  // Maskable icons must keep the logo inside the central 80 % safe zone on a full bleed.
  { file: "public/icon-maskable-512.png", size: 512, maskable: true },
  { file: "src/app/apple-icon.png", size: 180, maskable: true },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  const inner = t.maskable
    ? `<div style="width:100%;height:100%;background:#18a058;display:flex;align-items:center;justify-content:center">
         <div style="width:62%;height:62%">${mark.replace("<svg", '<svg width="100%" height="100%"')}</div></div>`
    : svg.replace("<svg", '<svg width="100%" height="100%"');
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: path.join(root, t.file), omitBackground: !t.maskable });
  await page.close();
  console.log("wrote", t.file);
}
await browser.close();
