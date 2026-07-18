/**
 * 对比原站和本地预览：截图 + 检查关键结构元素
 * 运行：node scripts/compare-original.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs", "research", "phase5-compare");
const LOCAL = "http://127.0.0.1:4321";
const REMOTE = "https://www.sharinglaundry.com";

const PAGES = [
  { path: "/about-us/", label: "about-us" },
  { path: "/contact-us/", label: "contact-us" },
  { path: "/application/", label: "application" },
  { path: "/refund-and-returns-policy/", label: "refund" },
  { path: "/support/", label: "support" },
  { path: "/news/", label: "news" },
  { path: "/shop/", label: "shop" },
  { path: "/products/", label: "products" },
  { path: "/product-category/washer-extractors/", label: "wc-washer" },
  { path: "/product/washer-extractor/", label: "product-washer" },
  { path: "/category/company-news/", label: "cat-news" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
};

async function inspectPage(page, url, label) {
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    return {
      url,
      status: resp?.status() ?? 0,
      ...(await page.evaluate(() => {
        const main = document.querySelector("main");
        const header = document.querySelector("header");
        const footer = document.querySelector("footer");
        const h1 = document.querySelector("h1");
        const nav = document.querySelector("nav");
        const forms = document.querySelectorAll("form").length;
        const imgs = document.querySelectorAll("img").length;
        const sections = document.querySelectorAll("section").length;
        const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
        const headingList = Array.from(headings)
          .map((el) => `${el.tagName}:${el.textContent.trim().slice(0, 30)}`)
          .filter(Boolean);
        return {
          h1: h1?.textContent?.trim() || "",
          mainLen: main?.textContent?.replace(/\s+/g, " ").trim().length || 0,
          hasHeader: !!header,
          hasFooter: !!footer,
          hasNav: !!nav,
          navLinks: nav ? nav.querySelectorAll("a").length : 0,
          imgs,
          sections,
          forms,
          headings: headingList.slice(0, 12),
          title: document.title,
        };
      })),
    };
  } catch (err) {
    return { url, error: String(err.message || err) };
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();

  for (const [vpName, vpSize] of Object.entries(VIEWPORTS)) {
    const localCtx = await browser.newContext({ viewport: vpSize });
    const localPage = await localCtx.newPage();

    const remoteCtx = await browser.newContext({ viewport: vpSize });
    const remotePage = await remoteCtx.newPage();

    for (const p of PAGES) {
      const localUrl = `${LOCAL}${p.path}`;
      const remoteUrl = `${REMOTE}${p.path}`;

      const local = await inspectPage(localPage, localUrl, p.label);
      const remote = await inspectPage(remotePage, remoteUrl, p.label);

      // 截图
      try {
        await localPage.screenshot({
          path: path.join(OUT_DIR, `local-${vpName}-${p.label}.png`),
          fullPage: true,
        });
        await remotePage.screenshot({
          path: path.join(OUT_DIR, `remote-${vpName}-${p.label}.png`),
          fullPage: true,
        });
      } catch {}

      // 输出
      const pad = (s, n = 36) => String(s).slice(0, n).padEnd(n);
      console.log(`\n=== ${p.path} ===`);
      if (local.error || remote.error) {
        console.log(`  LOCAL : ${local.error || "ok"}`);
        console.log(`  REMOTE: ${remote.error || "ok"}`);
        continue;
      }
      console.log(`  ${pad("")}  ${pad("LOCAL", 36)}  ${pad("REMOTE", 36)}`);
      console.log(`  ${pad("status")}  ${pad(local.status, 36)}  ${pad(remote.status, 36)}`);
      console.log(`  ${pad("h1")}  ${pad(local.h1, 36)}  ${pad(remote.h1, 36)}`);
      console.log(`  ${pad("main len")}  ${pad(local.mainLen, 36)}  ${pad(remote.mainLen, 36)}`);
      console.log(`  ${pad("imgs")}  ${pad(local.imgs, 36)}  ${pad(remote.imgs, 36)}`);
      console.log(`  ${pad("sections")}  ${pad(local.sections, 36)}  ${pad(remote.sections, 36)}`);
      console.log(`  ${pad("nav links")}  ${pad(local.navLinks, 36)}  ${pad(remote.navLinks, 36)}`);
      console.log(`  ${pad("has header/footer/nav")}  ${pad(`${local.hasHeader}/${local.hasFooter}/${local.hasNav}`, 36)}  ${pad(`${remote.hasHeader}/${remote.hasFooter}/${remote.hasNav}`, 36)}`);
      console.log(`  --- headings (local) ---`);
      for (const h of local.headings) console.log(`     ${h}`);
      console.log(`  --- headings (remote) ---`);
      for (const h of remote.headings) console.log(`     ${h}`);
    }

    await localCtx.close();
    await remoteCtx.close();
  }

  await browser.close();
  console.log(`\n截图目录: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
