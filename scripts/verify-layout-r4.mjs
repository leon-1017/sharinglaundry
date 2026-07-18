/**
 * R4 验证：通用页排版统一
 */
import { chromium } from "playwright";

async function collectSectionPadding(page) {
  return page.evaluate(() => {
    const values = new Set();
    document.querySelectorAll("section").forEach((el) => {
      const style = getComputedStyle(el);
      const top = parseFloat(style.paddingTop);
      const bottom = parseFloat(style.paddingBottom);
      if (top > 0) values.add(top);
      if (bottom > 0) values.add(bottom);
    });
    return Array.from(values).sort((a, b) => a - b);
  });
}

async function collectHeadingColors(page) {
  return page.evaluate(() => {
    const colors = new Set();
    const hero = document.querySelector("body > section:nth-of-type(1)");
    document.querySelectorAll("h1, h2, h3").forEach((el) => {
      if (hero && hero.contains(el)) return; // 跳过 Hero 区域标题（白色属于设计需要）
      const color = getComputedStyle(el).color;
      if (color && color !== "rgba(0, 0, 0, 0)") colors.add(color);
    });
    return Array.from(colors);
  });
}

async function checkMainWidth(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".pixel-container");
    return el ? el.getBoundingClientRect().width : 0;
  });
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const port = process.env.PREVIEW_PORT || "4321";

  // 首页：padding 种类、标题颜色种类
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(800);
  const homePadding = await collectSectionPadding(page);
  const homeColors = await collectHeadingColors(page);
  const homeWidth = await checkMainWidth(page);
  console.log("首页 section padding 种类:", homePadding);
  console.log("首页 heading 颜色种类:", homeColors);
  console.log("首页 pixel-container 宽度:", homeWidth);

  // contact-us：至少一个 .btn-primary
  await page.goto(`http://127.0.0.1:${port}/contact-us/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  const contactButtons = await page.locator(".btn-primary").count();
  console.log("contact-us .btn-primary 数量:", contactButtons);

  // refund：至少一个 .btn-primary
  await page.goto(`http://127.0.0.1:${port}/refund-and-returns-policy/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  const refundButtons = await page.locator(".btn-primary").count();
  console.log("refund .btn-primary 数量:", refundButtons);

  const checks = [
    homePadding.length <= 3,
    homeColors.length <= 2,
    homeWidth <= 1020,
    contactButtons >= 1,
    refundButtons >= 1,
  ];

  if (checks.every(Boolean)) {
    console.log("✅ R4 验证通过");
  } else {
    console.error("❌ R4 验证失败", checks);
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
