/**
 * R1 验证：导航 hover 不再消失
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(800);

  // 找到 Products 下拉父项
  const group = page.locator("header nav .group").first();
  const box = await group.boundingBox();
  if (!box) throw new Error("找不到下拉父项");

  // 移到父项文字
  await page.mouse.move(box.x + box.width / 2, box.y + 5);
  await page.waitForTimeout(300);

  // 移到子菜单区域
  const sub = group.locator("div.absolute").first();
  const subBox = await sub.boundingBox();
  if (!subBox) throw new Error("子菜单未渲染");

  // 沿路径移动：父项 → 子菜单 → 子菜单底部
  await page.mouse.move(subBox.x + 10, subBox.y + 5);
  await page.waitForTimeout(200);
  await page.mouse.move(subBox.x + 20, subBox.y + subBox.height / 2);
  await page.waitForTimeout(200);
  await page.mouse.move(subBox.x + 20, subBox.y + subBox.height - 5);
  await page.waitForTimeout(200);

  const visible = await sub.isVisible();
  const opacity = await sub.evaluate((el) => getComputedStyle(el).opacity);

  console.log("子菜单可见:", visible);
  console.log("子菜单 opacity:", opacity);

  if (!visible || opacity !== "1") {
    console.error("❌ R1 验证失败：子菜单 hover 后不可见");
    process.exitCode = 1;
  } else {
    console.log("✅ R1 验证通过");
  }

  await page.screenshot({ path: "docs/research/audit/r1-nav-hover.png" });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
