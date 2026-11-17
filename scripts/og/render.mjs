import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cardUrl = "file://" + resolve(here, "card.html");
const out = resolve(here, "../../frontend/public/preview-image.jpg");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(cardUrl, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await page.screenshot({ path: out, type: "jpeg", quality: 92 });
await browser.close();
console.log("Wrote", out);
