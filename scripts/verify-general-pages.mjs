/**
 * 验证 12 个通用页面：截图 + 检查关键元素
 * 运行：node scripts/verify-general-pages.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs", "research", "phase5-screenshots");
const BASE = "http://127.0.0.1:4321";

const PAGES = [
  { path: "/", title: "Home" },
  { path: "/about-us/", title: "About us" },
  { path: "/contact-us/", title: "Contact us" },
  { path: "/application/", title: "Application" },
  { path: "/support/", title: "Support" },
  { path: "/shop/", title: "Shop" },
  { path: "/news/", title: "News" },
  { path: "/refund-and-returns-policy/", title: "Refund and Returns Policy" },
  { path: "/products/", title: "Products" },
  { path: "/product-category/washer-extractors/", title: "Washer Extractors" },
  { path: "/product/washer-extractor/", title: "Washer Extractor" },
  { path: "/category/company-news/", title: "Company News" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const results = [];

  for (const vp of Object.entries(VIEWPORTS)) {
    const [vpName, vpSize] = vp;
    const context = await browser.newContext({ viewport: vpSize });
    const page = await context.newPage();

    for (const p of PAGES) {
      const url = `${BASE}${p.path}`;
      console.log(`[${vpName}] ${url}`);
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        const status = resp?.status() ?? 0;

        // 等到内容稳定
        await page.waitForTimeout(800);

        // 1) H1 数量检查
        const h1Count = await page.locator("h1").count();
        const h1Text = h1Count ? await page.locator("h1").first().textContent() : "";

        // 2) 主区域内容长度
        const mainText = await page.locator("main").first().innerText().catch(() => "");

        // 3) 主图（h1 之后的第一个 figure/img）
        const firstImgSrc = await page.evaluate(() => {
          const img = document.querySelector("main img");
          return img ? img.getAttribute("src") : null;
        });

        // 4) 图片数量
        const imgCount = await page.locator("main img").count();

        // 5) 链接数量
        const linkCount = await page.locator("main a").count();

        // 6) application 专用：检查 imageBoxCards 数量
        let cardCount = 0;
        if (p.path === "/application/") {
          cardCount = await page.locator("main a.group").count();
        }

        // 7) 通用：检查是否有重复 h1
        const h1Texts = await page.locator("h1").allTextContents();

        // 8) 截图
        const screenshotPath = path.join(
          OUT_DIR,
          `${vpName}-${p.path.replace(/[^\w-]+/g, "_") || "home"}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });

        results.push({
          path: p.path,
          status,
          h1Count,
          h1Text: h1Text?.trim().slice(0, 60),
          h1Texts: h1Texts.map((t) => t.trim().slice(0, 40)),
          mainLen: mainText.length,
          firstImgSrc,
          imgCount,
          linkCount,
          cardCount,
          screenshot: path.basename(screenshotPath),
        });
      } catch (err) {
        results.push({
          path: p.path,
          error: String(err.message || err),
        });
      }
    }
    await context.close();
  }

  await browser.close();

  console.log("\n=== 验证结果 ===\n");
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.path}  ERROR: ${r.error}`);
      continue;
    }
    const issues = [];
    if (r.h1Count > 1) issues.push(`h1×${r.h1Count}`);
    if (r.h1Count === 0) issues.push("无 h1");
    if (r.mainLen < 100) issues.push(`main 仅 ${r.mainLen} 字符`);
    if (r.path === "/application/" && r.cardCount !== 6) issues.push(`应用卡片 ${r.cardCount}/6`);
    const flag = issues.length ? `  ⚠ ${issues.join(", ")}` : "  ✓";
    console.log(`${r.path}  [${r.status}]  h1=${r.h1Count} main=${r.mainLen} imgs=${r.imgCount} links=${r.linkCount}${flag}`);
    if (r.h1Texts.length > 1) {
      console.log(`     h1s: ${JSON.stringify(r.h1Texts)}`);
    }
    if (r.firstImgSrc) {
      console.log(`     firstImg: ${r.firstImgSrc}`);
    }
  }

  console.log(`\n截图目录: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
