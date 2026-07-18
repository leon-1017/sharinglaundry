# 修复计划

> 基于 [AUDIT_ISSUES.md](./AUDIT_ISSUES.md) 23 个问题，分 6 个阶段渐进修复
> 每阶段独立可验证、可提交
> 全部完成后可清理 AUDIT_ISSUES.md 和附属审核产物

---

## 阶段总览

| 阶段 | 主题 | 覆盖问题 | 预期收益 |
|---|---|---|---|
| R1 | 导航与 hover 修复 | #1 #4 #5 | 二级菜单可用、字号匹配原站 |
| R2 | 动效系统搭建 | #2 #15 #17 | 全站有入场动画、header 滚动收缩 |
| R3 | 首页视觉强化 | #3 #7 #8 #12 #16 | 首页接近原站视觉冲击力 |
| R4 | 通用页排版统一 | #6 #9 #10 #11 #13 | 排版规范、间距一致 |
| R5 | 交互细节 | #14 #18 #19 #20 | 卡片 hover、返回顶部、移动端体验 |
| R6 | SEO 与数据接入 | #21 #22 #23 | 表单可提交、结构化数据完整 |

---

## R1 导航与 hover 修复

**目标**：解决二级菜单 hover 即消失的致命问题，对齐原站字号与图标

### 任务
- [ ] 修复 [Header.astro:19](file:///e:/Project/sharinglaundry/src/components/Header.astro#L19) 子菜单 gap：移除 `mt-4 translate-y-2`，改用 `pt-2` 或 `.group` 上加 `pb-2`
- [ ] 顶级链接字号 `text-[11px]` → `text-[14px]`（对齐原站 16px）
- [ ] 子菜单链接字号 `text-[11px]` → `text-[13px]`
- [ ] "v" 字符 → SVG chevron-down（内联，无依赖）
- [ ] 子菜单宽度 `w-64` → `w-56`，间距 `py-3` → `py-[10px]`

### 验证
- [ ] Playwright 模拟鼠标从父项移动到子菜单第 3 项，保持可见
- [ ] 桌面端导航字号视觉对比原站
- [ ] 构建 + 提交

### 涉及文件
- `src/components/Header.astro`

---

## R2 动效系统搭建

**目标**：为全站添加基础动画体系，恢复设计感

### 任务
- [ ] 在 [global.css](file:///e:/Project/sharinglaundry/src/styles/global.css) 定义 keyframes：
  - `@keyframes fadeInUp`（translateY 20px + opacity）
  - `@keyframes fadeIn`
  - `@keyframes slideInLeft` / `slideInRight`
- [ ] 创建 `src/components/ScrollReveal.astro`：基于 IntersectionObserver 的滚动入场组件
  - 监听 `[data-reveal]` 元素，进入视口加 `.is-visible` 类
  - 支持 `data-reveal-delay` 属性
- [ ] 在 MainLayout 末尾注入 ScrollReveal 脚本
- [ ] 为 section 加 `data-reveal` 属性（首页 + 通用页）
- [ ] Header 滚动收缩：JS 监听 `scrollY > 80` 加 `.is-scrolled` 类
  - CSS：`.is-scrolled { height: 80px; box-shadow: ...; }`
- [ ] 按钮 hover 微动画（已有，保留）

### 验证
- [ ] Playwright 检测 `animation` 数量 > 0
- [ ] 滚动页面时 section 有淡入上移效果
- [ ] 滚动 80px 后 header 高度收缩
- [ ] 构建 + 提交

### 涉及文件
- `src/styles/global.css`
- `src/components/ScrollReveal.astro`（新建）
- `src/layouts/MainLayout.astro`
- `src/components/Header.astro`
- `src/pages/index.astro`（加 data-reveal）

---

## R3 首页视觉强化

**目标**：首页视觉接近原站冲击力

### 任务
- [ ] Hero 标题 `text-[30px]` → `text-[36px] md:text-[42px]`
- [ ] Hero 增加 CTA 按钮组（主按钮 + 次按钮 "Contact Us"）
- [ ] Showcase 圆形图 `grayscale-[0.08]` → `grayscale group-hover:grayscale-0` + `transition duration-300`
- [ ] 移动端小字号修复：`text-[10px]` → `text-[12px]`（@media max-width:767px）
- [ ] 合作伙伴改 Swiper 轮播（或纯 CSS scroll-snap 简化方案）
- [ ] 客户评价改 Swiper 轮播
- [ ] Hero 区域加大背景图 + 深色蒙版（参考 contact-us 实现）

### 验证
- [ ] Playwright 移动端无 < 11px 文本
- [ ] 首页截图对比原站视觉接近
- [ ] 轮播可自动播放 + 手动切换
- [ ] 构建 + 提交

### 涉及文件
- `src/pages/index.astro`
- `src/styles/global.css`（移动端字号 media query）
- 可能引入 `swiper` 依赖（或自实现）

---

## R4 通用页排版统一

**目标**：建立排版规范，消除间距/颜色/按钮不一致

### 任务
- [ ] 定义 section padding 规范（写入 global.css）：
  - `.section-sm` py-56px
  - `.section-md` py-72px
  - `.section-lg` py-96px
- [ ] 首页 10 个 section 替换为规范类
- [ ] 标题颜色统一：h1/h2 用 `var(--site-heading)`，h3 用 `var(--site-blue-dark)`
- [ ] InquiryForm Send 按钮加 `.btn-primary` 类
- [ ] contact-us Hero 下方加 "Send Inquiry" 按钮（锚点到 #inquiry-form）
- [ ] refund 页末尾加 "Contact Sales" 按钮（链接到 /contact-us/）
- [ ] 通用页 mainWidth=1440 修复：审查 [...slug].astro 所有分支，全宽 section 包裹 `.pixel-container`

### 验证
- [ ] Playwright 检测 padding 种类 ≤ 3
- [ ] Playwright 检测标题颜色种类 ≤ 2
- [ ] contact-us 和 refund 检测到 `.btn-primary` ≥ 1
- [ ] mainWidth ≤ 1020（pixel-container 宽度）
- [ ] 构建 + 提交

### 涉及文件
- `src/styles/global.css`
- `src/pages/index.astro`
- `src/pages/[...slug].astro`
- `src/components/InquiryForm.astro`

---

## R5 交互细节

**目标**：补齐图片 hover、返回顶部、移动端体验

### 任务
- [ ] ProductGrid 图片加 `transition group-hover:scale-105`
- [ ] EntryGrid 卡片图片同上
- [ ] imageBoxCards（application 页）图片同上
- [ ] 创建 `src/components/BackToTop.astro`：浮动按钮 + scroll 监听
  - 滚动 > 500px 显示
  - 点击平滑滚动到顶部
- [ ] 移动端导航：`<details>` → 抽屉式菜单
  - 汉堡图标（3 条线 → X 动画）
  - 全屏覆盖 + 分级菜单
- [ ] 移动端产品列表：`grid-cols-1` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`

### 验证
- [ ] Playwright 桌面端卡片 hover 后图片放大
- [ ] 滚动 500px 后右下角出现返回顶部按钮
- [ ] 移动端导航为抽屉式
- [ ] 移动端产品列表为 2 列
- [ ] 构建 + 提交

### 涉及文件
- `src/components/ProductGrid.astro`
- `src/components/EntryGrid.astro`
- `src/pages/[...slug].astro`（imageBoxCards 分支）
- `src/components/BackToTop.astro`（新建）
- `src/layouts/MainLayout.astro`
- `src/components/Header.astro`

---

## R6 SEO 与数据接入

**目标**：补齐 SEO 元数据、结构化数据、表单提交

### 任务
- [ ] MainLayout 添加 Open Graph meta：
  - `og:title`、`og:description`、`og:image`、`og:url`
  - `twitter:card`、`twitter:title`、`twitter:image`
- [ ] 产品页添加 JSON-LD `Product` schema（name、image、description、brand）
- [ ] 文章页添加 JSON-LD `Article` schema
- [ ] 所有页面添加 `BreadcrumbList` schema
- [ ] InquiryForm 接入提交接口：
  - 方案 A：Cloudflare Workers + 邮件 API（推荐）
  - 方案 B：Formspree 第三方服务
  - 方案 C：mailto: 链接兜底
- [ ] 添加 `robots.txt` 和 `sitemap.xml`（Astro sitemap 已有，检查配置）

### 验证
- [ ] 页面源码包含 og:title meta
- [ ] 产品页源码包含 `application/ld+json` Product schema
- [ ] 表单提交后显示成功消息（非 "captured locally"）
- [ ] 构建 + 提交 + 部署验证

### 涉及文件
- `src/layouts/MainLayout.astro`
- `src/pages/[...slug].astro`（JSON-LD）
- `src/components/InquiryForm.astro`
- `public/robots.txt`（新建）
- 可能新建 `worker/` 目录（如方案 A）

---

## 执行规则

1. **顺序执行**：R1 → R2 → ... → R6，每阶段独立提交
2. **每阶段必须**：
   - 修改前阅读相关文件
   - 构建通过 `npm run build`
   - Playwright 验证（复用 `scripts/audit-site.mjs` 作为回归）
   - git commit + push
3. **不跨阶段修改**：R1 只改 Header，不碰动效；R2 只搭动效框架，不碰首页布局
4. **可中断**：任何阶段完成后可暂停，下次从下一阶段继续
5. **可验证**：每阶段都有明确的验证清单
6. **清理**：R6 完成后删除 `docs/AUDIT_ISSUES.md`、`docs/REPAIR_PLAN.md`、审核脚本和截图

---

## 进度追踪

| 阶段 | 状态 | 提交 hash | 完成时间 |
|---|---|---|---|
| R1 导航与 hover 修复 | ✅ 已完成 | 76c4e3f | 2026-07-18 |
| R2 动效系统搭建 | ✅ 已完成 | 013c049 | 2026-07-18 |
| R3 首页视觉强化 | ⏳ 待开始 | - | - |
| R4 通用页排版统一 | ⏳ 待开始 | - | - |
| R5 交互细节 | ⏳ 待开始 | - | - |
| R6 SEO 与数据接入 | ⏳ 待开始 | - | - |

状态标记：⏳ 待开始 / 🔄 进行中 / ✅ 已完成

---

## 修复完成后清理

执行以下命令清理审核产物：

```powershell
Remove-Item docs/AUDIT_ISSUES.md
Remove-Item docs/REPAIR_PLAN.md
Remove-Item docs/research/audit -Recurse
Remove-Item scripts/audit-site.mjs
Remove-Item scripts/audit-nav-compare.mjs
```
