/**
 * R6 验证：SEO 与数据接入
 */
import { chromium } from "playwright";

async function getMetaContent(page, property) {
  return page.$eval(`meta[property="${property}"], meta[name="${property}"]`, (el) => el.content).catch(() => null);
}

async function getJsonLd(page, type) {
  return page.evaluate((targetType) => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        if (data["@type"] === targetType) return data;
      } catch {
        // ignore
      }
    }
    return null;
  }, type);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const port = process.env.PREVIEW_PORT || "4321";

  // 任意页面源码包含 og:title
  await page.goto(`http://127.0.0.1:${port}/about-us/`, { waitUntil: "networkidle", timeout: 15000 });
  const ogTitle = await getMetaContent(page, "og:title");
  const ogImage = await getMetaContent(page, "og:image");
  const twitterTitle = await getMetaContent(page, "twitter:title");
  console.log("og:title:", ogTitle);
  console.log("og:image:", ogImage);
  console.log("twitter:title:", twitterTitle);

  // 产品页包含 Product schema 和 BreadcrumbList
  await page.goto(`http://127.0.0.1:${port}/product/barrier-washer-extractor/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);
  const productSchema = await getJsonLd(page, "Product");
  const breadcrumbSchema = await getJsonLd(page, "BreadcrumbList");
  console.log("Product schema:", productSchema ? { name: productSchema.name, brand: productSchema.brand } : null);
  console.log("BreadcrumbList items:", breadcrumbSchema?.itemListElement?.length);

  // robots.txt 和 sitemap 存在
  const robots = await page.goto(`http://127.0.0.1:${port}/robots.txt`, { timeout: 10000 });
  const robotsText = await robots.text();
  const hasRobots = robotsText.includes("User-agent:") && robotsText.includes("Sitemap:");
  console.log("robots.txt OK:", hasRobots);

  const sitemap = await page.goto(`http://127.0.0.1:${port}/sitemap-index.xml`, { timeout: 10000 });
  const sitemapText = await sitemap.text();
  const hasSitemap = sitemapText.includes("<sitemapindex") || sitemapText.includes("<urlset");
  console.log("sitemap OK:", hasSitemap);

  // 表单提交成功消息（本地 preview 不运行 Functions，mock /api/inquiry）
  await page.route(`http://127.0.0.1:${port}/api/inquiry`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "Thank you for your inquiry. We will get back to you soon." }),
    });
  });
  await page.goto(`http://127.0.0.1:${port}/contact-us/`, { waitUntil: "networkidle", timeout: 15000 });
  await page.fill("[data-inquiry-form] input[name='name']", "Test User");
  await page.fill("[data-inquiry-form] input[name='email']", "test@example.com");
  await page.fill("[data-inquiry-form] textarea[name='message']", "Hello, this is a test inquiry.");
  await page.click("[data-inquiry-form] button[type='submit']");
  await page.waitForTimeout(800);
  const successText = await page.locator("[data-inquiry-success]").textContent();
  console.log("表单成功消息:", successText);

  const checks = [
    Boolean(ogTitle),
    Boolean(ogImage),
    Boolean(twitterTitle),
    productSchema?.["@type"] === "Product",
    Array.isArray(breadcrumbSchema?.itemListElement) && breadcrumbSchema.itemListElement.length >= 2,
    hasRobots,
    hasSitemap,
    successText && !successText.includes("captured locally") && successText.toLowerCase().includes("thank"),
  ];

  if (checks.every(Boolean)) {
    console.log("✅ R6 验证通过");
  } else {
    console.error("❌ R6 验证失败", checks);
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
