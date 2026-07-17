/**
 * 列表页验证:检查 4 个列表页(/products/, /product-category/washer-extractors/,
 * /products/tumble-dryers/, /shop/)的产品卡片是否正确渲染
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const PAGES = [
  "/products/",
  "/products/washer-extractors/",
  "/product-category/washer-extractors/",
  "/products/tumble-dryers/",
  "/shop/",
  "/news/",
];

const BASE = "http://127.0.0.1:4321";
const OUT_DIR = "docs/design-references";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });

    const slug = path.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "products";

    // 1. 抓取产品卡片(查找所有 .card-link 链接,排除 header/footer/related)
    const productCards = await page
      .locator("main .card-link")
      .evaluateAll((els) =>
        els.map((el) => ({
          href: el.getAttribute("href") || "",
          title: el.querySelector("h3")?.textContent?.trim() || "",
          image: el.querySelector("img")?.getAttribute("src") || "",
        }))
      );

    // 2. 抓取 canonical URL
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");

    // 3. 抓取页面 h1
    const h1 = await page.locator("h1").first().textContent();

    // 截图
    await page.screenshot({
      path: `${OUT_DIR}/local-list-${slug}.png`,
      fullPage: true,
    });

    results.push({
      path,
      h1: h1?.trim(),
      canonical,
      productCardCount: productCards.length,
      firstCard: productCards[0],
    });
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
