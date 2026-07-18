/**
 * R3 验证：首页视觉强化
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const port = process.env.PREVIEW_PORT || "4321";
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1000);

  // 1. Hero 标题字号（data-reveal 初始 opacity 0，用 $eval 不等待可见）
  const titleSize = await page.$eval("body > section:nth-of-type(1) h1", (el) => parseFloat(getComputedStyle(el).fontSize));
  console.log("Hero 标题字号:", titleSize, "px");

  // 2. CTA 按钮组
  const hasPrimary = await page.locator('a[href="/products/"].btn-primary').isVisible();
  const hasSecondary = await page.locator('a[href="/contact-us/"].btn-secondary').isVisible();
  console.log("主 CTA:", hasPrimary, "次 CTA:", hasSecondary);

  // 3. Hero 背景图
  const heroBgSrc = await page.$eval("body > section:nth-of-type(1) > img", (el) => el.src).catch(() => null);
  console.log("Hero 背景图:", heroBgSrc);

  // 4. Showcase hover 灰度
  const showcaseClasses = await page.$eval(".showcase-label", (el) => {
    const img = el.parentElement?.querySelector("img");
    return { grayscale: img?.classList.contains("grayscale"), transition: img?.classList.contains("transition") };
  });
  console.log("Showcase grayscale:", showcaseClasses?.grayscale, "transition:", showcaseClasses?.transition);

  // 5. 轮播存在
  const partnerCarousel = page.locator('[data-carousel-id="partners"]');
  const testimonialCarousel = page.locator('[data-carousel-id="testimonials"]');
  const partnerPrev = partnerCarousel.locator(".carousel-prev");
  const testimonialNext = testimonialCarousel.locator(".carousel-next");
  console.log("Partners 轮播:", await partnerCarousel.isVisible(), "prev:", await partnerPrev.isVisible());
  console.log("Testimonials 轮播:", await testimonialCarousel.isVisible(), "next:", await testimonialNext.isVisible());

  // 6. 移动端最小字号
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle", timeout: 15000 });
  await mobilePage.waitForTimeout(800);
  const tooSmall = await mobilePage.evaluate(() => {
    const all = document.querySelectorAll("*");
    const offenders = [];
    for (const el of all) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && size < 11) {
        offenders.push({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 40), size });
        if (offenders.length >= 10) break;
      }
    }
    return offenders;
  });
  console.log("移动端 <11px 文本:", tooSmall.length > 0 ? tooSmall : "无");

  const checks = [
    titleSize >= 36,
    hasPrimary && hasSecondary,
    heroBgSrc && heroBgSrc.includes("wp-assets"),
    showcaseClasses?.grayscale && showcaseClasses?.transition,
    await partnerCarousel.isVisible(),
    await testimonialCarousel.isVisible(),
    await partnerPrev.isVisible(),
    await testimonialNext.isVisible(),
    tooSmall.length === 0,
  ];

  if (checks.every(Boolean)) {
    console.log("✅ R3 验证通过");
  } else {
    console.error("❌ R3 验证失败", checks);
    process.exitCode = 1;
  }

  await page.screenshot({ path: "docs/research/audit/r3-home-desktop.png" });
  await mobilePage.screenshot({ path: "docs/research/audit/r3-home-mobile.png" });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
