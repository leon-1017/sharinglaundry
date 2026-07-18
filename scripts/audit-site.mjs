/**
 * 综合审核：布局、设计、动效、交互
 * 检查导航 hover、动画/过渡、间距一致性等
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs", "research", "audit");
const BASE = "http://127.0.0.1:4321";

const PAGES = [
  { path: "/", label: "home" },
  { path: "/products/", label: "products" },
  { path: "/products/washer-extractors/", label: "products-washer" },
  { path: "/product/washer-extractor/", label: "product-washer-detail" },
  { path: "/about-us/", label: "about-us" },
  { path: "/contact-us/", label: "contact-us" },
  { path: "/application/", label: "application" },
  { path: "/support/", label: "support" },
  { path: "/news/", label: "news" },
  { path: "/refund-and-returns-policy/", label: "refund" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const issues = [];

  // === 1. 桌面端审核 ===
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopCtx.newPage();

  for (const p of PAGES) {
    const url = `${BASE}${p.path}`;
    console.log(`[desktop] ${url}`);
    try {
      await desktopPage.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      await desktopPage.waitForTimeout(800);

      const result = await desktopPage.evaluate(() => {
        const issues = [];

        // 1. 检查过渡和动画
        const allEls = document.querySelectorAll("*");
        let animatedCount = 0;
        let transitionCount = 0;
        for (const el of allEls) {
          const style = getComputedStyle(el);
          if (style.transition && style.transition !== "all 0s ease 0s") transitionCount++;
          if (style.animation && style.animation !== "none") animatedCount++;
        }
        if (transitionCount < 5) issues.push(`过渡元素仅 ${transitionCount} 个（动效缺失）`);
        if (animatedCount === 0) issues.push("无 keyframe 动画");

        // 2. 检查间距一致性（统计 padding/margin 模式）
        const sections = document.querySelectorAll("section");
        const paddings = new Set();
        sections.forEach((s) => {
          const pl = getComputedStyle(s).paddingTop;
          if (pl && pl !== "0px") paddings.add(pl);
        });
        if (paddings.size > 8) issues.push(`section padding 不一致：${[...paddings].slice(0, 10).join(", ")}`);

        // 3. 检查颜色一致性
        const headings = document.querySelectorAll("h1, h2, h3");
        const hColors = new Set();
        headings.forEach((h) => {
          hColors.add(getComputedStyle(h).color);
        });
        if (hColors.size > 5) issues.push(`标题颜色 ${hColors.size} 种：${[...hColors].slice(0, 6).join(" | ")}`);

        // 4. 检查按钮样式一致性
        const btns = document.querySelectorAll("a.btn-primary, button.btn-primary, .btn-primary");
        if (btns.length === 0) issues.push("无 .btn-primary 类按钮");
        const btnStyles = new Set();
        btns.forEach((b) => {
          const s = getComputedStyle(b);
          btnStyles.add(`${s.backgroundColor}|${s.color}|${s.padding}|${s.borderRadius}`);
        });
        if (btnStyles.size > 2) issues.push(`按钮样式 ${btnStyles.size} 种`);

        // 5. 检查主区域文本对齐和宽度
        const main = document.querySelector("main");
        const mainWidth = main ? main.scrollWidth : 0;
        if (mainWidth > 1440) issues.push(`main 宽度 ${mainWidth}px 超过视口`);

        // 6. 检查图片是否有 alt
        const imgsNoAlt = document.querySelectorAll("main img:not([alt])").length;
        if (imgsNoAlt > 0) issues.push(`${imgsNoAlt} 张图片缺 alt`);

        // 7. 检查段落和标题层级
        const h1Count = document.querySelectorAll("h1").length;
        if (h1Count > 1) issues.push(`h1 数量 ${h1Count}`);
        if (h1Count === 0) issues.push("缺 h1");

        // 8. 检查是否所有 section 有 consistent container
        const containers = document.querySelectorAll(".pixel-container, .container");
        if (containers.length === 0) issues.push("无 .pixel-container 容器");

        return {
          issues,
          stats: {
            sections: sections.length,
            transitions: transitionCount,
            animations: animatedCount,
            headings: headings.length,
            buttons: btns.length,
            containers: containers.length,
            mainWidth,
          },
        };
      });

      for (const issue of result.issues) {
        issues.push({ page: p.path, viewport: "desktop", issue, stats: result.stats });
      }

      await desktopPage.screenshot({
        path: path.join(OUT_DIR, `desktop-${p.label}.png`),
        fullPage: true,
      });
    } catch (err) {
      issues.push({ page: p.path, viewport: "desktop", issue: `ERROR: ${err.message}` });
    }
  }
  await desktopCtx.close();

  // === 2. 移动端审核 ===
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();

  for (const p of PAGES.slice(0, 6)) {
    const url = `${BASE}${p.path}`;
    console.log(`[mobile] ${url}`);
    try {
      await mobilePage.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await mobilePage.waitForTimeout(800);

      const result = await mobilePage.evaluate(() => {
        const issues = [];
        const main = document.querySelector("main");
        if (main && main.scrollWidth > 375) {
          issues.push(`水平溢出 ${main.scrollWidth - 375}px`);
        }
        // 检查文字是否过小
        const smallTexts = document.querySelectorAll("*");
        let smallTextCount = 0;
        for (const el of smallTexts) {
          if (el.children.length === 0) {
            const fs = parseFloat(getComputedStyle(el).fontSize);
            if (fs > 0 && fs < 11) smallTextCount++;
          }
        }
        if (smallTextCount > 5) issues.push(`${smallTextCount} 个文本元素 < 11px`);
        return { issues };
      });
      for (const issue of result.issues) {
        issues.push({ page: p.path, viewport: "mobile", issue });
      }
      await mobilePage.screenshot({
        path: path.join(OUT_DIR, `mobile-${p.label}.png`),
        fullPage: true,
      });
    } catch (err) {
      issues.push({ page: p.path, viewport: "mobile", issue: `ERROR: ${err.message}` });
    }
  }
  await mobileCtx.close();

  // === 3. 导航 hover 测试 ===
  console.log("[nav] testing dropdown hover...");
  const navCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const navPage = await navCtx.newPage();
  await navPage.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 15000 });
  await navPage.waitForTimeout(1000);

  const navIssues = await navPage.evaluate(async () => {
    const issues = [];
    const nav = document.querySelector("header nav") || document.querySelector("nav");
    if (!nav) return { issues: ["无 nav 元素"] };

    // 找到所有有子菜单的顶级菜单项
    const dropdownItems = nav.querySelectorAll(":scope > ul > li, :scope > div > ul > li");
    const topLevelLinks = nav.querySelectorAll("a");
    const found = [];

    for (const li of nav.querySelectorAll("li")) {
      const subMenu = li.querySelector("ul, .dropdown, .submenu, [data-dropdown], .mega-menu");
      if (subMenu) {
        const linkText = li.querySelector("a")?.textContent?.trim() || "";
        found.push({ linkText, hasSub: true });
      }
    }

    if (found.length === 0) issues.push("未找到下拉子菜单结构");
    else issues.push(`发现 ${found.length} 个下拉菜单: ${found.map((f) => f.linkText).join(", ")}`);

    return { issues, found };
  });
  for (const issue of navIssues.issues) {
    issues.push({ page: "/", viewport: "desktop", issue: `[NAV] ${issue}` });
  }

  // 实际 hover 测试
  try {
    const nav = await navPage.locator("header nav li:has(ul)").first();
    if (nav) {
      const box = await nav.boundingBox();
      if (box) {
        // 移到父项
        await navPage.mouse.move(box.x + box.width / 2, box.y + 5);
        await navPage.waitForTimeout(500);
        // 移到子菜单区域
        const subMenu = await nav.locator("ul").first();
        const subBox = await subMenu.boundingBox();
        if (subBox) {
          await navPage.mouse.move(subBox.x + 10, subBox.y + 10);
          await navPage.waitForTimeout(300);
          const isVisible = await subMenu.isVisible();
          if (!isVisible) {
            issues.push({ page: "/", viewport: "desktop", issue: "[NAV] hover 子菜单后消失（gap 问题）" });
          } else {
            issues.push({ page: "/", viewport: "desktop", issue: "[NAV] ✓ 子菜单 hover 可见" });
          }
        }
      }
    } else {
      issues.push({ page: "/", viewport: "desktop", issue: "[NAV] 未找到带 ul 的 li" });
    }
  } catch (err) {
    issues.push({ page: "/", viewport: "desktop", issue: `[NAV] 测试出错: ${err.message}` });
  }
  await navPage.screenshot({ path: path.join(OUT_DIR, "nav-hover-test.png") });
  await navCtx.close();

  await browser.close();

  // 输出
  console.log("\n=== 审核结果 ===\n");
  for (const i of issues) {
    console.log(`[${i.viewport}] ${i.page}  ${i.issue}`);
  }
  console.log(`\n共 ${issues.length} 条问题/观察`);
  console.log(`截图目录: ${OUT_DIR}`);

  // 保存 JSON
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    path.join(OUT_DIR, "audit-issues.json"),
    JSON.stringify(issues, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
