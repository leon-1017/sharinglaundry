/**
 * R2 验证：滚动入场动画 + header 滚动收缩
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const port = process.env.PREVIEW_PORT || "4321";
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(600);

  // 1. 检查存在 ScrollReveal 脚本与 data-reveal 属性
  const revealCount = await page.locator("[data-reveal]").count();
  const hasObserverScript = await page.locator("script").evaluateAll((scripts) =>
    scripts.some((s) => s.textContent.includes("IntersectionObserver") && s.textContent.includes("data-reveal"))
  );

  console.log("data-reveal 元素数:", revealCount);
  console.log("ScrollReveal 脚本存在:", hasObserverScript);

  if (revealCount === 0 || !hasObserverScript) {
    console.error("❌ R2 验证失败：缺少动画属性或脚本");
    process.exitCode = 1;
    await browser.close();
    return;
  }

  // 2. 滚动后检查 header 是否获得 is-scrolled 类
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(200);
  const headerScrolled = await page.locator("header").evaluate((el) => el.classList.contains("is-scrolled"));
  console.log("header is-scrolled:", headerScrolled);

  if (!headerScrolled) {
    console.error("❌ R2 验证失败：header 未在滚动后收缩");
    process.exitCode = 1;
    await browser.close();
    return;
  }

  // 3. 滚动到页面底部触发多个 reveal，检查 is-visible 类被添加
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const visibleCount = await page.locator("[data-reveal].is-visible").count();
  console.log("已可见 reveal 元素数:", visibleCount);

  if (visibleCount < revealCount * 0.5) {
    console.error("❌ R2 验证失败：reveal 元素未获得 is-visible 类");
    process.exitCode = 1;
    await browser.close();
    return;
  }

  console.log("✅ R2 验证通过");
  await page.screenshot({ path: "docs/research/audit/r2-scroll-bottom.png" });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
