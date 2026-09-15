import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceHtml = 'file://' + path.join(__dirname, 'icon-source.html');
const outDir = path.join(__dirname, '..', 'public', 'icons');

const sizes = [180, 192, 512];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 });
  await page.goto(sourceHtml);
  const el = await page.$('.icon');
  await el.screenshot({ path: path.join(outDir, `icon-${size}.png`) });
  await page.close();
  console.log(`wrote icon-${size}.png`);
}
await browser.close();
