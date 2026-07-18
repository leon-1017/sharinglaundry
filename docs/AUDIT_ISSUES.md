# 站点迁移问题审核报告

> 生成时间：2026-07-18
> 审核方式：Playwright 自动化检测 + 源码审查 + 原站对比
> 审核范围：10 个核心页面（首页、产品、列表、通用页）× 桌面端 + 移动端
> 截图目录：[docs/research/audit/](file:///e:/Project/sharinglaundry/docs/research/audit)
> 完成修复后可清理本文件

---

## P0 严重问题（必须修复）

### #1 导航条二级菜单 hover 即消失 ⚠️ 高优先级
- **影响范围**：所有页面（header 是全局组件）
- **现象**：鼠标从父菜单项移到子菜单时，子菜单瞬间消失
- **根因**：[src/components/Header.astro#L19](file:///e:/Project/sharinglaundry/src/components/Header.astro#L19) 子菜单使用 `mt-4` (16px 上边距) + `translate-y-2` (8px 位移)，造成约 24px 的空白 gap。由于子菜单是 `position: absolute`，这块 gap 不在父 `.group` 容器内，鼠标穿越时 `group:hover` 状态丢失
- **原站对比**：原站使用 HFE Elementor 插件的 `<ul class="sub-menu">` 原生结构，子菜单紧贴父项（无 gap），通过 `:hover` 状态保持显示
- **修复方案**：
  ```diff
  - <div class="invisible absolute left-0 top-full mt-4 w-64 translate-y-2 ...">
  + <div class="invisible absolute left-0 top-full w-64 translate-y-0 pt-2 ...">
  ```
  或者在 `.group` 上加 `pb-2` 让父容器延伸到子菜单顶部

### #2 全站无 keyframe 动画 ⚠️ 设计感缺失
- **影响范围**：所有 10 个被测页面
- **现象**：Playwright 检测 `animation: none`，无任何 `@keyframes` 定义
- **数据**：
  - 首页：0 动画 / 306 过渡
  - 产品页：0 动画 / 312 过渡
  - 所有页面均为 0 动画
- **原站对比**：原站有 hero 入场动画、icon-box 滑入、按钮 hover 动效、客户评价轮播等
- **修复方案**：在 [src/styles/global.css](file:///e:/Project/sharinglaundry/src/styles/global.css) 添加：
  - `@keyframes fadeInUp` 用于 section 入场
  - `@keyframes slideInLeft` / `slideInRight` 用于卡片
  - IntersectionObserver 触发滚动入场
  - 首页 hero 标题、按钮入场动画

### #3 移动端首页文字过小
- **影响范围**：移动端首页 `/`
- **现象**：16 个文本元素 fontSize < 11px（实际为 10px）
- **数据**：导航 "Folders" 等小圆标签 `text-[10px]`、客户评价角色 `text-[10px]`、热线副标题 `text-[11px]`
- **修复方案**：移动端 `@media (max-width: 767px)` 下将这些提升到 12px

---

## P1 重要问题（影响体验）

### #4 导航条顶级链接字号过小
- **影响范围**：所有页面
- **本地**：`text-[11px]`（11px）
- **原站**：`font-size: 16px`
- **位置**：[src/components/Header.astro#L16](file:///e:/Project/sharinglaundry/src/components/Header.astro#L16), [L22](file:///e:/Project/sharinglaundry/src/components/Header.astro#L22), [L30](file:///e:/Project/sharinglaundry/src/components/Header.astro#L30)
- **修复**：改为 `text-[14px]` 或 `text-[15px]`

### #5 子菜单图标用 "v" 字符代替
- **影响范围**：导航 "Products" 父项
- **现象**：`<span class="text-[9px]">v</span>` 用小写 v 代替下拉箭头
- **位置**：[src/components/Header.astro#L17](file:///e:/Project/sharinglaundry/src/components/Header.astro#L17)
- **修复**：使用 SVG 或 FontAwesome chevron-down 图标

### #6 contact-us 和 refund 页面无主按钮
- **影响范围**：`/contact-us/`、`/refund-and-returns-policy/`
- **现象**：检测到 `.btn-primary` 数量 = 0
- **位置**：[src/pages/[...slug].astro](file:///e:/Project/sharinglaundry/src/pages/%5B...slug%5D.astro) 中通用页 main 分支
- **修复**：在 contact-us Hero 下方添加 "Send Inquiry" 按钮（锚点到表单），refund 页面添加 "Contact Sales" 按钮

### #7 首页 hero 标题字号偏小
- **影响范围**：`/`
- **现象**：`text-[30px]`（桌面）vs 原站约 40-48px
- **位置**：[src/pages/index.astro#L15](file:///e:/Project/sharinglaundry/src/pages/index.astro#L15)
- **修复**：提升到 `text-[36px] md:text-[42px]`

### #8 客户评价 / 合作伙伴无轮播
- **影响范围**：首页 Cooperative Partners、Our Customer Say
- **现象**：纯静态网格，原站为轮播组件
- **修复**：引入 Swiper.js 或自实现简单轮播

---

## P2 排版/设计问题（改进）

### #9 Section padding 不一致
- **影响范围**：首页 10 个 section
- **现象**：section padding 种类超过 8 种：`py-[58px]`、`py-[70px]`、`py-[78px]`、`py-[82px]`、`py-[86px]`、`py-[98px]`、`pb-[80px] pt-[66px]`
- **修复**：统一为 3 档（小: 56px / 中: 72px / 大: 96px）

### #10 标题颜色种类过多
- **影响范围**：所有页面
- **现象**：h1/h2/h3 颜色 > 5 种
- **修复**：统一为 `var(--site-blue-dark)` 和 `var(--site-heading)`

### #11 按钮样式不统一
- **现象**：存在多种 padding / borderRadius 组合
- **位置**：InquiryForm 的 Send 按钮 vs `.btn-primary`
- **修复**：InquiryForm 的 button 统一加 `.btn-primary` 类

### #12 首页 Showcase 圆形产品图 grayscale 滤镜过淡
- **现象**：`grayscale-[0.08]` 几乎无效果
- **位置**：[src/pages/index.astro#L30](file:///e:/Project/sharinglaundry/src/pages/index.astro#L30)
- **原站**：hover 时彩色，默认灰度更高
- **修复**：`grayscale` 默认 + `group-hover:grayscale-0` 过渡

### #13 通用页 mainWidth = 1440px（全宽）
- **现象**：Playwright 检测多个页面 `mainWidth: 1440`
- **根因**：某些 section 使用了非 `.pixel-container` 的全宽结构
- **修复**：审查 [...slug].astro 通用页分支，确保所有内容包裹在 `.pixel-container` 内

---

## P3 交互/动效问题（优化）

### #14 图片无 hover 缩放效果
- **影响范围**：除首页 showcase 外的所有页面
- **现象**：产品卡片、application 子卡片缺少 `hover:scale-105`
- **修复**：为 ProductGrid、EntryGrid、imageBoxCards 统一加 hover 缩放

### #15 滚动入场动画缺失
- **现象**：所有 section 直接显示，无滚动触发动画
- **修复**：添加 IntersectionObserver + CSS 动画类

### #16 Hero 区域无视觉冲击力
- **现象**：首页、about-us、application 等页面 hero 仅为文字 + 小装饰条
- **原站**：Hero 有大图 + 蒙版 + 标题
- **修复**：通用页加 Hero 图 + 深色蒙版（参考 contact-us 的实现）

### #17 导航条无 sticky 收缩效果
- **现象**：`sticky top-0` 后无视觉变化
- **原站**：滚动后 header 高度收缩 + 阴影
- **修复**：JS 监听 scroll 添加 `.is-scrolled` 类

### #18 无 "返回顶部" 按钮
- **现象**：长页面（产品列表、新闻）无返回顶部
- **修复**：添加浮动按钮 + 滚动 500px 后显示

---

## P4 响应式问题

### #19 移动端导航菜单展开样式简陋
- **现象**：使用原生 `<details>` 折叠，样式接近无
- **位置**：[src/components/Header.astro#L39-L61](file:///e:/Project/sharinglaundry/src/components/Header.astro#L39)
- **修复**：改为全屏抽屉式菜单 + 汉堡图标动画

### #20 移动端产品列表非 2 列
- **现象**：默认单列，移动端密度过低
- **修复**：`grid-cols-2` 默认 + `sm:grid-cols-3` + `lg:grid-cols-4`

---

## 数据/SEO 问题

### #21 InquiryForm 无实际提交接口
- **现象**：表单仅前端验证，显示"Inquiry captured locally"
- **位置**：[src/components/InquiryForm.astro](file:///e:/Project/sharinglaundry/src/components/InquiryForm.astro)
- **修复**：接入 Cloudflare Workers / Formspree / 邮件 API

### #22 缺少结构化数据 JSON-LD
- **影响范围**：产品页、文章页
- **修复**：添加 Product、Article、BreadcrumbList schema

### #23 无 Open Graph / Twitter Card meta
- **位置**：[src/layouts/MainLayout.astro](file:///e:/Project/sharinglaundry/src/layouts/MainLayout.astro)
- **修复**：添加 og:title、og:description、og:image、twitter:card

---

## 修复优先级汇总

| 优先级 | 编号 | 标题 | 涉及文件 |
|---|---|---|---|
| **P0** | #1 | 导航 hover gap 修复 | Header.astro |
| **P0** | #2 | 添加全站动效 | global.css + IntersectionObserver |
| **P0** | #3 | 移动端小字号修复 | index.astro + [...slug].astro |
| **P1** | #4 | 导航字号 11→14px | Header.astro |
| **P1** | #5 | 下拉箭头 SVG | Header.astro |
| **P1** | #6 | contact/refund 加按钮 | [...slug].astro |
| **P1** | #7 | 首页 hero 标题放大 | index.astro |
| **P1** | #8 | 评价/伙伴轮播 | index.astro + Swiper |
| **P2** | #9 | Section padding 统一 | 多文件 |
| **P2** | #10 | 标题颜色统一 | global.css |
| **P2** | #11 | 按钮样式统一 | InquiryForm.astro |
| **P2** | #12 | Showcase 灰度 | index.astro |
| **P2** | #13 | mainWidth 全宽修复 | [...slug].astro |
| **P3** | #14-18 | 动效/交互优化 | 多文件 |
| **P4** | #19-20 | 移动端导航/列表 | Header.astro + ProductGrid |
| **数据** | #21-23 | 表单/SEO | 多文件 |

---

## 审核工具/脚本

- [scripts/audit-site.mjs](file:///e:/Project/sharinglaundry/scripts/audit-site.mjs) — 自动化布局/动效检测
- [scripts/audit-nav-compare.mjs](file:///e:/Project/sharinglaundry/scripts/audit-nav-compare.mjs) — 导航原站对比
- 截图：[docs/research/audit/](file:///e:/Project/sharinglaundry/docs/research/audit)
  - desktop-{home,products,about-us,...}.png
  - mobile-{home,products,...}.png
  - nav-hover-test.png
  - audit-issues.json（原始检测数据）
  - nav-compare.json（导航对比数据）

---

## 修复后清理指引

完成所有修复后，可清理：
1. 删除本文件 `docs/AUDIT_ISSUES.md`
2. 删除 `docs/research/audit/` 目录
3. 删除 `scripts/audit-site.mjs` 和 `scripts/audit-nav-compare.mjs`（除非保留作为回归测试）
