# Sharing Laundry 网站重构计划

> 目标：将 https://www.sharinglaundry.com 的所有页面内容完整拉取到本地，并以像素级精度重构为 Astro 静态站点。
> 原则：尽量省 token（能用脚本批量处理的绝不手工编辑；能复用组件的绝不重复编写）。

## 一、现状盘点

### 1.1 已有资产

| 资产 | 位置 | 数量/状态 | 说明 |
|---|---|---|---|
| URL 清单 | `docs/research/url-manifest.json` | 82 条 | 来自 sitemap，含 post/page/product/category 等 |
| 原始 HTML | `docs/research/source-html/` | 82 个文件 | **已完整抓取**，是重构的真正数据源 |
| 图片/字体/JS/CSS | `public/wp-assets/` | 860 个文件 | 已完整下载到本地 |
| 设计参考图 | `docs/design-references/` | 8 张 | 首页/产品/联系页的像素对比截图 |
| 组件规格 | `docs/research/components/*.spec.md` | 4 份 | header/home-hero/inquiry-form/product-detail |
| 页面拓扑 | `docs/research/PAGE_TOPOLOGY.md` | 1 份 | 首页区块结构说明 |
| 行为说明 | `docs/research/BEHAVIORS.md` | 1 份 | 交互行为说明 |

### 1.2 核心问题

**当前 `src/data/site-data.json` 是由 `scripts/build-fallback-data.mjs` 生成的占位数据，并非真实内容。**

- `build-fallback-data.mjs` 只读取 `url-manifest.json`（URL 列表），然后用模板字符串生成假内容。
- `scripts/scrape-site.mjs` 虽然能抓取真实 HTML 并提取内容，但生成的 `site-data.json` 被 `build-fallback-data.mjs` 覆盖了。
- **真正的原始 HTML 已经躺在 `docs/research/source-html/` 里**，只是从未被解析成结构化数据。

### 1.3 受影响的页面分类与数量

| 类型 | 数量 | 优先级 | 说明 |
|---|---|---|---|
| home | 1 | P0 | 首页 |
| product | 20 | P0 | 产品详情页（含技术参数表） |
| products (列表) | 8 | P0 | 产品分类列表页 |
| page | 12 | P1 | 关于我们/联系/支持/应用等 |
| post | 31 | P2 | 新闻/发货记录 |
| category | 2 | P3 | 新闻分类归档页 |
| productCategory | 7 | P3 | 产品分类归档页 |
| shop | 1 | P3 | 商店页（重定向到 products） |
| **合计** | **82** | | |

## 二、重构策略：解析本地 HTML，而非重新抓取

### 2.1 核心思路

**不重新联网抓取**，因为：
1. 源站不稳定（此前抓取时 0 个页面成功从源站获取，全部走本地缓存）。
2. `docs/research/source-html/` 已有全部 82 个页面的完整 HTML。
3. 资源已全部下载到 `public/wp-assets/`。

**新写一个解析脚本** `scripts/parse-local-html.mjs`，从本地 HTML 文件提取真实内容，生成新的 `site-data.json`。

### 2.2 Token 节省策略

| 策略 | 说明 |
|---|---|
| 脚本驱动 | 用 Node.js 脚本批量解析 HTML，不在对话中逐页处理 |
| 组件复用 | 所有产品页共用一个 `[...slug].astro` 模板，所有列表页共用 `EntryGrid` |
| 增量构建 | 每完成一个阶段就 `npm run build` 验证，不一次性大改 |
| 分批提交 | 每个阶段完成后 git commit，便于回滚 |
| 只读必要内容 | 解析 HTML 时只提取 `<main>` / `<article>` 内的核心内容，跳过 `<head>` 的 CSS/JS 声明 |

## 三、分步执行计划

### 阶段 0：准备工作（前置）

**目标**：确认本地 HTML 文件完整性和可解析性。

- [ ] 0.1 验证 `docs/research/source-html/` 的 82 个 HTML 文件全部存在且非空
- [ ] 0.2 抽查 3 个代表性页面（home、product、post），确认 Elementor 结构可被 cheerio 解析
- [ ] 0.3 确认 `public/wp-assets/` 中图片路径与 HTML 中的引用一致

**验证方式**：
```bash
# 统计 HTML 文件数量
ls docs/research/source-html/*.html | wc -l   # 应为 82
```

---

### 阶段 1：编写 HTML 解析脚本（P0 核心）

**目标**：用脚本从本地 HTML 提取真实内容，替换 `site-data.json` 中的占位数据。

**输出**：新脚本 `scripts/parse-local-html.mjs`，新数据 `src/data/site-data.json`（真实内容）。

- [ ] 1.1 创建 `scripts/parse-local-html.mjs`
  - 读取 `docs/research/url-manifest.json` 获取 URL→文件名映射
  - 对每个 URL，定位对应的 `docs/research/source-html/{slug}.html` 文件
  - 用 cheerio 解析 HTML，提取：
    - `<title>` / `meta[name=description]` / `meta[property=og:*]`
    - `<script type="application/ld+json">` 中的 datePublished / dateModified
    - `<main>` 或 `<article>` 内的正文 HTML
    - 所有 `<img>` 的 src（重写为 `/wp-assets/...` 本地路径）
    - 产品页：提取技术参数表（`<table>` 内容）
    - 产品页：提取 Features 列表
  - 输出结构与现有 `site-data.json` 兼容，但 `contentHtml` 为真实内容
- [ ] 1.2 运行脚本生成新的 `site-data.json`
- [ ] 1.3 `npm run build` 验证 82 页全部成功
- [ ] 1.4 `npm run check:links` 验证无断链
- [ ] 1.5 git commit

**脚本核心逻辑示意**：

```javascript
// 伪代码
for (const row of manifest) {
  const slug = slugFromUrl(row.url);              // home, product__washer-extractor, ...
  const htmlFile = `docs/research/source-html/${slug}.html`;
  const html = await readFile(htmlFile);
  const $ = cheerio.load(html);

  const title = extractTitle($);
  const description = getMeta($, 'description');
  const contentHtml = cleanContent($);            // 提取 <main> 内容，重写图片路径
  const images = extractImages($);                // 提取所有图片，重写为 /wp-assets/...

  // 产品页特殊处理
  if (row.url.includes('/product/')) {
    const techTable = extractTechTable($);       // 提取技术参数 <table>
    const features = extractFeatures($);         // 提取特性列表
    entry.techTable = techTable;
    entry.features = features;
  }
}
```

**Token 节省点**：整个解析逻辑写在一个脚本里，一次性处理 82 个页面，不需要在对话中逐页讨论。

---

### 阶段 2：首页像素级还原（P0）

**目标**：首页与原站视觉一致。

- [ ] 2.1 对比 `docs/research/source-html/home.html` 与当前 `src/pages/index.astro`
- [ ] 2.2 提取首页所有区块的真实文案到 `src/data/home-content.ts`：
  - Hero 区标题、副标题、CTA 文案
  - QUALITY / EXPERT / PRICE 三卡片文案（用原文，非改写）
  - Why Choose Us 四项（Expert Engineers / Experience Skills / Guarantee Service / Trusted Work）
  - 合作伙伴 logos
  - 客户评价 testimonials 文案
  - 新闻列表
- [ ] 2.3 修正首页布局 CSS，确保与原站一致：
  - 白色 hero + 右侧斜切浅色面板
  - 居中蓝色标题 + 绿色 CTA
  - 圆形产品入口
  - 阴影三列价值卡片
  - 灰色 why/form 区
  - testimonial 网格
  - hotline CTA band
  - 白色 footer
- [ ] 2.4 `npm run build && npm run preview` 截图对比
- [ ] 2.5 git commit

**验证方式**：截图与 `docs/design-references/home-desktop.png` 对比。

---

### 阶段 3：产品详情页还原（P0，20 页）

**目标**：20 个产品页有真实产品描述、技术参数表、特性列表。

- [ ] 3.1 修改 `src/types/content.ts`，在 entry 类型中增加：
  - `techTable?: { headers: string[]; rows: string[][] }`
  - `features?: string[]`
- [ ] 3.2 在 `scripts/parse-local-html.mjs` 中为 product 类页面提取：
  - 技术参数表（通常是 `<table class="woocommerce-product-attributes">` 或 Elementor 表格）
  - Features 列表（通常是 `<ul>` 或 `<div class="elementor-icon-list">`）
- [ ] 3.3 修改 `src/pages/[...slug].astro`：
  - Description / Technical Parameters 标签页改为真实可切换（加 `<script>` 实现切换）
  - 有 `techTable` 时渲染参数表
  - 有 `features` 时渲染特性列表
- [ ] 3.4 重新构建并验证 3 个代表性产品页
- [ ] 3.5 git commit

**Token 节省点**：所有 20 个产品页共用同一个 `[...slug].astro` 模板和同一个 ProductDetail 组件，只改数据不改模板。

---

### 阶段 4：列表页还原（P0，8 页）

**目标**：产品分类列表页显示真实产品卡片。

- [ ] 4.1 验证 `products/*` 和 `product-category/*` 页面的列表数据正确
- [ ] 4.2 统一产品分类路径（消除 `/products/` 与 `/product-category/` 两套路径的重复内容）
- [ ] 4.3 确保 `EntryGrid` / `EntryCard` 组件渲染真实产品图和标题
- [ ] 4.4 git commit

---

### 阶段 5：通用页面还原（P1，12 页）

**目标**：关于我们、联系、支持、应用等页面有真实内容。

- [ ] 5.1 验证 `parse-local-html.mjs` 已正确提取这些页面的正文
- [ ] 5.2 检查 `/about-us/`、`/contact-us/`、`/support/` 页面内容
- [ ] 5.3 检查 `/application/*` 6 个应用页面内容
- [ ] 5.4 检查 `/refund-and-returns-policy/` 页面内容
- [ ] 5.5 git commit

---

### 阶段 6：新闻文章页还原（P2，31 页）

**目标**：新闻/发货记录页面有真实正文和图片。

- [ ] 6.1 验证 `parse-local-html.mjs` 已正确提取 post 类页面的正文和图片
- [ ] 6.2 检查新闻列表页 `/news/` 的分页和卡片
- [ ] 6.3 抽查 5 篇新闻文章确认正文完整
- [ ] 6.4 git commit

---

### 阶段 7：归档页与边缘页面（P3，10 页）

**目标**：category、productCategory、shop 页面正常。

- [ ] 7.1 `/category/company-news/`、`/category/uncategorized/` 列表正确
- [ ] 7.2 7 个 `/product-category/*` 页面列表正确
- [ ] 7.3 `/shop/` 页面正常（或重定向到 `/products/`）
- [ ] 7.4 git commit

---

### 阶段 8：SEO 与结构化数据

**目标**：每个页面有正确的 meta 信息和 JSON-LD。

- [ ] 8.1 在 `MainLayout.astro` 中补充：
  - `<link rel="canonical">`
  - Twitter Card meta（`twitter:card`、`twitter:title`、`twitter:description`、`twitter:image`）
  - Open Graph 完整字段
- [ ] 8.2 从原始 HTML 的 JSON-LD 中提取并输出：
  - 产品页：Product schema（name, description, image, brand）
  - 新闻页：Article schema（headline, datePublished, author）
  - 全站：Organization schema（name, url, logo, sameAs）
- [ ] 8.3 生成 `sitemap-index.xml` 和 `robots.txt`
- [ ] 8.4 git commit

---

### 阶段 9：交互修复

**目标**：修复假交互，表单可提交。

- [ ] 9.1 产品页 Description/Features 标签切换（纯前端 JS）
- [ ] 9.2 InquiryForm 接入真实提交端点（预留 API 路径，或接入第三方表单服务）
- [ ] 9.3 移动端菜单可访问性（aria-expanded、aria-current）
- [ ] 9.4 404 页面
- [ ] 9.5 git commit

---

### 阶段 10：图片优化与性能

**目标**：图片有尺寸、响应式、现代格式。

- [ ] 10.1 为所有 `<img>` 添加 `width` / `height`
- [ ] 10.2 首屏图片添加 `fetchpriority="high"` 或 `preload`
- [ ] 10.3 生成 `srcset` 响应式图片（利用已有的 `-600x450.jpg`、`-768x576.jpg` 等缩略图）
- [ ] 10.4 git commit

---

### 阶段 11：最终验证与部署

- [ ] 11.1 `npm run build` 全量构建
- [ ] 11.2 `npm run check:links` 全量链接检查
- [ ] 11.3 `npm run preview` 本地预览全站
- [ ] 11.4 抽查 10 个关键页面截图对比
- [ ] 11.5 更新 `docs/DEPLOYMENT.md`
- [ ] 11.6 git commit & push

## 四、风险与应对

| 风险 | 应对 |
|---|---|
| 部分 HTML 文件结构不一致 | 脚本中增加 fallback 逻辑，解析失败时保留原有占位内容 |
| 技术参数表格式不统一 | 按 product 类型分别处理，先处理 5 个高优先级产品 |
| 图片路径映射不全 | 复用 `scrape-site.mjs` 中已有的 `absoluteToPublicAsset` 逻辑 |
| 构建失败 | 每阶段构建验证，失败立即回滚 |

## 五、预估工作量

| 阶段 | 主要产出 | 依赖 |
|---|---|---|
| 0 | 验证清单 | 无 |
| 1 | parse-local-html.mjs + 真实 site-data.json | 0 |
| 2 | 首页还原 | 1 |
| 3 | 产品详情页还原 | 1 |
| 4 | 列表页还原 | 1 |
| 5 | 通用页面还原 | 1 |
| 6 | 新闻页还原 | 1 |
| 7 | 归档页还原 | 1 |
| 8 | SEO + JSON-LD | 2-7 |
| 9 | 交互修复 | 3 |
| 10 | 图片优化 | 2-7 |
| 11 | 最终验证 | 全部 |

## 六、立即执行的第一步

**从阶段 1 开始**：编写 `scripts/parse-local-html.mjs`，从本地 HTML 提取真实内容。这是所有后续阶段的基础，且能一次性解决 82 个页面的内容问题，是 token 效率最高的方案。
