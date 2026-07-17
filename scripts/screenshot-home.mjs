import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const URL = process.env.TARGET_URL || "http://127.0.0.1:4322/";
const outDir = path.join(rootDir, "docs", "design-references");
const outFile = path.join(outDir, "local-home-after-phase2.png");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForLoadState("domcontentloaded");
// Allow images/lazy content to settle
await page.waitForTimeout(1500);

await mkdir(outDir, { recursive: true });

// Full-page screenshot at the configured viewport.
await page.screenshot({ path: outFile, fullPage: true });

// ---------- Extract text content ----------
const h1 = (await page.locator("h1").first().innerText()).trim();

const highlightTitles = await page
  .locator("article h2")
  .allInnerTexts();
const highlightBodies = await page.evaluate(() => {
  const articles = Array.from(document.querySelectorAll("article"));
  const result = [];
  for (const art of articles) {
    const h2 = art.querySelector("h2");
    if (!h2) continue;
    const upper = (h2.textContent || "").trim();
    if (!/^(QUALITY|EXPERT|PRICE)$/i.test(upper)) continue;
    const p = art.querySelector("p");
    result.push({ title: upper, body: (p?.textContent || "").trim() });
  }
  return result;
});

const reasonsTitles = await page.evaluate(() => {
  const headings = Array.from(document.querySelectorAll("h3"));
  return headings.map((h) => (h.textContent || "").trim());
});

const testimonialQuotes = await page.evaluate(() => {
  // The testimonial section is the one with h2 "Our Customer Say"
  const sections = Array.from(document.querySelectorAll("section"));
  const target = sections.find((s) =>
    /Our Customer Say/i.test(s.querySelector("h2")?.textContent || "")
  );
  if (!target) return [];
  return Array.from(target.querySelectorAll("article p"))
    .map((p) => (p.textContent || "").trim())
    .filter(Boolean);
});

const hotlinePhone = await page.evaluate(() => {
  const sections = Array.from(document.querySelectorAll("section"));
  for (const s of sections) {
    const text = (s.textContent || "").trim();
    if (/HOTLINE/i.test(text) && /Start Your Laundry Business/i.test(text)) {
      // The phone is rendered as a direct div with font size 28
      const nodes = Array.from(s.querySelectorAll("div"));
      for (const n of nodes) {
        const t = (n.textContent || "").trim();
        if (/^\+?\d[\d\s\-,.+()]{6,}$/.test(t)) return t;
      }
    }
  }
  return "";
});

await browser.close();

const result = {
  url: URL,
  screenshot: outFile,
  h1,
  highlights: highlightBodies,
  reasonsTitles,
  testimonialQuotes: testimonialQuotes.map((q) => q.slice(0, 80)),
  hotlinePhone,
};

console.log(JSON.stringify(result, null, 2));
