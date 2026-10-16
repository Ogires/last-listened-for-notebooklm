// Rasteriza icons/icon.svg a los PNG que pide Chrome (16, 32, 48, 128) con el
// Chromium de Playwright, sin dependencias nuevas. El de 128 lleva 16 px de
// margen transparente por lado (arte de 96 px), como pide la Chrome Web Store.
//
// Ejecutar: npm run icons
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const svg = readFileSync('icons/icon.svg', 'utf8');
const SIZES = { 16: 0, 32: 0, 48: 0, 128: 16 }; // tamaño -> margen en px

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [size, pad] of Object.entries(SIZES).map(([s, p]) => [Number(s), p])) {
    const art = size - pad * 2;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
        <div style="padding:${pad}px;width:${art}px;height:${art}px">
          ${svg.replace('<svg ', `<svg width="${art}" height="${art}" `)}
        </div></body></html>`
    );
    await page.screenshot({ path: `icons/icon-${size}.png`, omitBackground: true });
    console.log(`icons/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
process.exit(0);
