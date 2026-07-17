/**
 * 产品页标签切换验证:截取 3 个产品页(默认 Description + 点击 Parameters 后)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const PRODUCTS = [
  "/product/washer-extractor/",
  "/product/commercial-washing-machine/",
  "/product/coin-operated-washing-machine/",
  "/product/tilting-washer-extractor/",
];

const BASE = "http://127.0.0.1:4321";
const OUT_DIR = "docs/design-references";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const results = [];

  for (const path of PRODUCTS) {
    const slug = path.replace(/^\/|\/$/g, "").replace(/\//g, "-");
    await page.goto(BASE + path, { waitUntil: "networkidle" });

    // 1. 默认 Description 状态
    const descVisible = await page.locator("[data-tab-panel='description']").isVisible();
    const paramVisibleBefore = await page.locator("[data-tab-panel='parameters']").isVisible().catch(() => null);
    await page.screenshot({
      path: `${OUT_DIR}/local-product-${slug}-description.png`,
      fullPage: true,
    });

    // 2. 点击 Technical Parameters 标签
    const paramBtn = page.locator("[data-tab='parameters']");
    const hasParamBtn = await paramBtn.count();
    if (hasParamBtn) {
      await paramBtn.click();
      await page.waitForTimeout(300);
      const paramVisibleAfter = await page.locator("[data-tab-panel='parameters']").isVisible();
      const descHiddenAfter = await page
        .locator("[data-tab-panel='description']")
        .evaluate((el) => el.classList.contains("hidden"));

      // 提取参数表前几行
      const tableFirstRows = await page
        .locator("[data-tab-panel='parameters'] table tr")
        .evaluateAll((rows) =>
          rows.slice(0, 4).map((r) =>
            Array.from(r.querySelectorAll("td,th")).map((c) => c.textContent?.trim()).join(" | ")
          )
        );

      await page.screenshot({
        path: `${OUT_DIR}/local-product-${slug}-parameters.png`,
        fullPage: true,
      });

      results.push({
        path,
        descVisible,
        paramBtnExists: true,
        paramVisibleAfter,
        descHiddenAfter,
        tablePreview: tableFirstRows,
      });
    } else {
      results.push({ path, descVisible, paramBtnExists: false });
    }
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
