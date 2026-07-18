/**
 * R5 验证：交互细节
 */
import { chromium } from "playwright";

async function hasCssRule(page, selectorText) {
  return page.evaluate((sel) => {
    function walk(rules) {
      for (const rule of rules) {
        if (rule.cssText && rule.cssText.includes(sel)) return true;
        if (rule.cssRules && walk(rule.cssRules)) return true;
      }
      return false;
    }
    for (const sheet of document.styleSheets) {
      try {
        if (walk(sheet.cssRules)) return true;
      } catch {
        // cross-origin stylesheets may throw
      }
    }
    return false;
  }, selectorText);
}

async function main() {
  const browser = await chromium.launch();
  const port = process.env.PREVIEW_PORT || "4321";

  // 桌面端：卡片 hover 放大（检查类名 + CSS rule）
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();

  await page.goto(`http://127.0.0.1:${port}/products/washer-extractors/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  const card = page.locator(".card-link").first();
  const img = card.locator("img").first();
  const imgHasHoverClass = await img.evaluate((el) => el.classList.contains("group-hover:scale-105"));
  const cardHasGroupClass = await card.evaluate((el) => el.classList.contains("group"));
  const ruleExists = await hasCssRule(page, "scale-105");
  console.log("桌面卡片 group 类:", cardHasGroupClass, "图片 hover 类:", imgHasHoverClass, "CSS rule:", ruleExists);

  // BackToTop 按钮
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  const backToTop = page.locator("[data-back-to-top]");
  const hiddenAtTop = await backToTop.evaluate((el) => getComputedStyle(el).opacity === "0");
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.waitForTimeout(350);
  const visibleAfterScroll = await backToTop.evaluate((el) => getComputedStyle(el).opacity === "1");
  console.log("BackToTop 顶部隐藏:", hiddenAtTop, "滚动后显示:", visibleAfterScroll);

  // 移动端：抽屉菜单
  const mobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mPage = await mobile.newPage();
  await mPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  await mPage.waitForTimeout(300);
  const toggle = mPage.locator(".mobile-menu-btn");
  const drawer = mPage.locator(".mobile-drawer");
  const hidden = await drawer.evaluate((el) => !el.classList.contains("is-open"));
  await toggle.click();
  await mPage.waitForTimeout(350);
  const open = await drawer.evaluate((el) => el.classList.contains("is-open"));
  console.log("移动端抽屉状态:", hidden, "=>", open);

  // 移动端产品列表 2 列
  await mPage.goto(`http://127.0.0.1:${port}/products/washer-extractors/`, { waitUntil: "networkidle", timeout: 15000 });
  await mPage.waitForTimeout(500);
  const grid = mPage.locator(".card-link").first().locator("..");
  const gridCols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  console.log("移动端产品列表列数:", gridCols);

  const checks = [
    cardHasGroupClass,
    imgHasHoverClass,
    ruleExists,
    hiddenAtTop,
    visibleAfterScroll,
    hidden,
    open,
    gridCols === 2,
  ];
  if (checks.every(Boolean)) {
    console.log("✅ R5 验证通过");
  } else {
    console.error("❌ R5 验证失败", checks);
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
