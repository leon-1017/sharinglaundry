/**
 * 对比原站与本地导航条结构、动效
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs", "research", "audit");
const LOCAL = "http://127.0.0.1:4321";
const REMOTE = "https://www.sharinglaundry.com";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const results = { local: {}, remote: {} };
  for (const [label, BASE] of [["local", LOCAL], ["remote", REMOTE]]) {
    console.log(`\n=== ${label} ===`);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(1500);

    const navInfo = await page.evaluate(() => {
      const header = document.querySelector("header");
      if (!header) return { error: "no header" };
      const nav = header.querySelector("nav") || document.querySelector("nav");
      if (!nav) return { error: "no nav in header", headerHtml: header.outerHTML.slice(0, 500) };

      const topItems = nav.querySelectorAll(":scope > *");
      const topStruct = [];
      const dropdowns = [];

      // 检查每个直接子元素
      const allNavLinks = nav.querySelectorAll("a");
      const allNavLists = nav.querySelectorAll("ul, .submenu, .dropdown, .mega-menu, [data-dropdown]");

      // 查找子菜单
      nav.querySelectorAll("li").forEach((li) => {
        const sub = li.querySelector(":scope > ul, :scope > .submenu, :scope > .dropdown");
        if (sub) {
          const linkText = li.querySelector("a")?.textContent?.trim() || "";
          const subItems = Array.from(sub.querySelectorAll(":scope > li > a, :scope > a"))
            .map((a) => a.textContent?.trim() || "");
          dropdowns.push({ linkText, subItems: subItems.slice(0, 5) });
        }
      });

      // 直接查找包含下拉菜单的结构（用 div.group 也算）
      const groupDropdowns = [];
      nav.querySelectorAll(".group, [data-dropdown], .has-dropdown, .menu-item-has-children").forEach((el) => {
        const link = el.querySelector(":scope > a")?.textContent?.trim() || "";
        const sub = el.querySelector(":scope > .dropdown, :scope > ul, :scope > .submenu");
        if (sub) {
          const items = Array.from(sub.querySelectorAll("a")).map((a) => a.textContent?.trim() || "");
          groupDropdowns.push({ parent: link, items: items.slice(0, 8) });
        }
      });

      // 检查 nav 内所有 a 的样式
      const firstLink = allNavLinks[0];
      const linkStyle = firstLink ? {
        color: getComputedStyle(firstLink).color,
        fontSize: getComputedStyle(firstLink).fontSize,
        textTransform: getComputedStyle(firstLink).textTransform,
      } : null;

      // 检查 hover 行为
      const navHoverInfo = {
        usesGroupHover: !!nav.querySelector(".group-hover\\:visible, .group:hover"),
        usesJsHover: !!nav.querySelector("[data-hover], [onmouseover]"),
        cssHoverRules: "无法直接检测",
      };

      return {
        topItemCount: topItems.length,
        topLevelTexts: Array.from(allNavLinks).slice(0, 10).map((a) => a.textContent?.trim() || ""),
        dropdownCount: dropdowns.length,
        dropdowns: dropdowns.slice(0, 10),
        groupDropdownCount: groupDropdowns.length,
        groupDropdowns: groupDropdowns.slice(0, 10),
        linkStyle,
        navHoverInfo,
        navHtml: nav.outerHTML.slice(0, 1500),
      };
    });
    results[label] = navInfo;
    console.log(JSON.stringify(navInfo, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, `${label}-home-full.png`), fullPage: true });
    await page.close();
  }

  // 写入 JSON
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path.join(OUT_DIR, "nav-compare.json"), JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
