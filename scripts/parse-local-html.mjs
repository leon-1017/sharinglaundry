/**
 * 从 docs/research/source-html/ 下的本地 HTML 文件解析真实内容，
 * 生成 src/data/site-data.json 替换占位数据。
 *
 * 运行：node scripts/parse-local-html.mjs
 */
import * as cheerio from "cheerio";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const SITE = "https://www.sharinglaundry.com";
const SOURCE_HTML_DIR = path.join(rootDir, "docs", "research", "source-html");
const MANIFEST_PATH = path.join(rootDir, "docs", "research", "url-manifest.json");
const OUT_PATH = path.join(rootDir, "src", "data", "site-data.json");

/* ── URL / 路径工具 ─────────────────────────────────────── */

function toPathname(raw) {
  const url = new URL(raw);
  let p = url.pathname || "/";
  if (!p.endsWith("/")) p += "/";
  return p;
}

function slugFromPath(pathname) {
  return pathname.replace(/^\/|\/$/g, "") || "home";
}

function classify(url, sitemapSource) {
  const p = toPathname(url);
  if (p === "/") return "home";
  if (p === "/shop/") return "shop";
  if (p.startsWith("/product/")) return "product";
  if (p.startsWith("/product-category/")) return "productCategory";
  if (p.startsWith("/category/")) return "category";
  if (sitemapSource.includes("post-sitemap")) return "post";
  return "page";
}

/** URL → 对应的本地 HTML 文件名 */
function urlToHtmlFile(url) {
  const pathname = toPathname(url);
  const slug = slugFromPath(pathname);
  return slug.replace(/\//g, "__") + ".html";
}

/** 将源站图片/CSS/JS URL 重写为本地 /wp-assets/ 路径 */
function rewriteAssetUrl(src) {
  if (!src) return null;
  try {
    const url = new URL(src, SITE);
    if (!url.hostname.endsWith("sharinglaundry.com")) return null;
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith("/wp-content/uploads/")) {
      return "/wp-assets/uploads/" + p.slice("/wp-content/uploads/".length);
    }
    if (p.startsWith("/wp-content/plugins/")) {
      return "/wp-assets/plugins/" + p.slice("/wp-content/plugins/".length);
    }
    if (p.startsWith("/wp-content/themes/")) {
      return "/wp-assets/themes/" + p.slice("/wp-content/themes/".length);
    }
    if (p.startsWith("/wp-includes/")) {
      return "/wp-assets/wp-includes/" + p.slice("/wp-includes/".length);
    }
    return null;
  } catch {
    return null;
  }
}

/** 将源站内部链接重写为本地路径 */
function rewriteInternalUrl(href) {
  if (!href) return null;
  try {
    const url = new URL(href, SITE);
    if (url.hostname.endsWith("sharinglaundry.com")) {
      return url.pathname + (url.search || "");
    }
    return null;
  } catch {
    return null;
  }
}

/* ── 通用提取工具 ───────────────────────────────────────── */

function getMeta($, name) {
  return (
    $("meta[name='" + name + "']").attr("content") ||
    $("meta[property='og:" + name + "']").attr("content") ||
    ""
  ).trim();
}

function extractTitle($) {
  const raw =
    $("meta[property='og:title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    "Untitled";
  return raw
    .replace(/\s+-\s+Wuxi Sharing Machinery Co\.,Ltd\s*$/i, "")
    .trim();
}

function extractJsonLdDates($) {
  const dates = {};
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const value = JSON.parse($(el).text());
      const nodes = Array.isArray(value)
        ? value
        : [value, ...(value["@graph"] || [])];
      for (const node of nodes) {
        if (node?.datePublished && !dates.datePublished)
          dates.datePublished = node.datePublished;
        if (node?.dateModified && !dates.dateModified)
          dates.dateModified = node.dateModified;
      }
    } catch {
      /* 忽略损坏的 JSON-LD */
    }
  });
  // 从 URL 提取日期作为后备
  return dates;
}

function extractDateFromUrl(url) {
  const m = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** 提取页面所有图片，返回去重后的本地路径数组 */
function extractAllImages($) {
  const images = [];
  const seen = new Set();
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;
    const local = rewriteAssetUrl(src);
    if (local && !seen.has(local)) {
      seen.add(local);
      images.push(local);
    }
  });
  // 也检查 gallery 的 data-thumbnail
  $(".e-gallery-image").each((_, el) => {
    const thumb = $(el).attr("data-thumbnail");
    if (!thumb) return;
    const local = rewriteAssetUrl(thumb);
    if (local && !seen.has(local)) {
      seen.add(local);
      images.push(local);
    }
  });
  return images;
}

/** 从纯文本生成摘要 */
function makeExcerpt(html, maxLen = 220) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

/**
 * 移除 contentHtml 起始处最近的 h1，避免与模板里的 <h1>{title}</h1> 重复。
 * 触发条件：起始 h1 的文本与 entry.title 匹配，或匹配 "Category: X" 形式
 */
function stripLeadingH1(html, title) {
  if (!html) return html;
  const $ = cheerio.load(`<div id="__root__">${html}</div>`, null, false);
  const $root = $("#__root__");
  // 找到起始处最近的 h1（仅前 200 字符范围内）
  const head = $root.html()?.slice(0, 400) || "";
  const firstH1Match = head.match(/<h1\b[\s\S]*?<\/h1>/i);
  if (!firstH1Match) return html;
  // 用 cheerio 解析
  const $inner = cheerio.load(firstH1Match[0], null, false);
  const innerTextRaw = $inner.root().text();
  const innerText = innerTextRaw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const normalizedTitle = (title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const shouldRemove =
    innerText === normalizedTitle ||
    /^category\s*:/i.test(innerTextRaw) ||
    (innerText.endsWith("archives") &&
      innerText.replace(/\s+archives$/, "") ===
        normalizedTitle.replace(/\s+archives$/, ""));

  if (!shouldRemove) return html;
  return html.replace(firstH1Match[0], "");
}

/* ── 产品页提取 ────────────────────────────────────────── */

function extractProductPage($) {
  // 产品图库
  const galleryImages = [];
  const seen = new Set();
  $(
    ".woocommerce-product-gallery__image img, .woocommerce-product-gallery__wrapper img"
  ).each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-large_image");
    if (!src) return;
    const local = rewriteAssetUrl(src);
    if (local && !seen.has(local)) {
      seen.add(local);
      galleryImages.push(local);
    }
  });

  // Description tab（特性列表）
  let descHtml = "";
  const descTab = $("#tab-description");
  if (descTab.length) {
    // 移除 <h2>Description</h2> 标题（模板已自带标签页标题）
    descTab.find("h2").first().remove();
    descHtml = descTab.html() || "";
    descHtml = descHtml.replace(/\n{3,}/g, "\n\n").replace(/<p>\s*<\/p>/g, "").trim();
  }

  // Features tab（技术参数表）
  // 部分产品使用 yikes-custom-woo-tab 插件的独立 "technical-parameters" tab
  let techTableHtml = "";
  const featuresTabs = [
    $("#tab-features").find("table").first(),
    $("#tab-technical-parameters").find("table").first(),
  ];
  for (const table of featuresTabs) {
    if (table.length) {
      // 清理表格：移除内联样式，保留结构
      table.find("*").each((_, el) => {
        const tag = el.tagName?.toLowerCase();
        for (const attr of Object.keys(el.attribs || {})) {
          if (!["colspan", "rowspan", "width"].includes(attr)) {
            $(el).removeAttr(attr);
          }
        }
        if (tag === "p") {
          // 将 <p> 包裹的文本直接替换为文本节点
          $(el).replaceWith($(el).text());
        }
      });
      techTableHtml = $.html(table);
      break;
    }
  }

  return { contentHtml: descHtml, techTableHtml, images: galleryImages };
}

/* ── Elementor 页面提取 ────────────────────────────────── */

function extractElementorContent($) {
  const parts = [];
  const images = [];
  const imageBoxCards = [];
  let h1Skipped = false;

  // 查找主内容区
  const mainContainer =
    $("main#content").first().length
      ? $("main#content").first()
      : $("main#main").first().length
        ? $("main#main").first()
        : $("main").first();

  if (!mainContainer.length) return { contentHtml: "", images, imageBoxCards };

  // 按文档顺序遍历所有 Elementor widget
  mainContainer.find(".elementor-widget").each((_, widget) => {
    const $w = $(widget);
    const cls = ($w.attr("class") || "").split(/\s+/);

    // 跳过 header/footer 位置的 widget
    if (
      $w.closest(
        ".elementor-location-header, .elementor-location-footer"
      ).length
    )
      return;

    if (cls.includes("elementor-widget-text-editor")) {
      const raw = $w.find(".elementor-widget-container").html() || "";
      let html = raw.trim();
      if (html) {
        // 如果 text-editor 内容未包裹在 <p> 中（Elementor 经常输出纯文本），自动包裹
        if (!/^\s*<\s*(p|div|h[1-6]|ul|ol|table|blockquote|figure|hr|iframe)/i.test(html)) {
          html = `<p>${html}</p>`;
        }
        parts.push(html);
        // 收集图片
        $w.find("img").each((_, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src");
          if (src) {
            const local = rewriteAssetUrl(src);
            if (local && !images.includes(local)) images.push(local);
          }
        });
      }
    } else if (cls.includes("elementor-widget-heading")) {
      const $title = $w.find(".elementor-heading-title").first();
      if ($title.length) {
        const text = $title.text().trim();
        const tag = $title.get(0)?.tagName?.toLowerCase() || "h2";
        // 跳过第一个 h1（页面主标题由模板渲染），避免重复
        if (tag === "h1" && !h1Skipped) {
          h1Skipped = true;
        } else if (text) {
          parts.push(`<${tag}>${text}</${tag}>`);
        }
      }
    } else if (cls.includes("elementor-widget-image-box")) {
      const $figure = $w.find(".elementor-image-box-img img").first();
      const $link = $w.find(".elementor-image-box-title a").first();
      const $title = $w.find(".elementor-image-box-title").first();
      if ($figure.length) {
        const src = $figure.attr("src") || $figure.attr("data-src");
        const local = src ? rewriteAssetUrl(src) : null;
        const titleText = $title.text().trim();
        const linkHref =
          rewriteInternalUrl($link.attr("href")) || $link.attr("href") || "#";
        if (local) {
          if (!images.includes(local)) images.push(local);
          imageBoxCards.push({
            title: titleText,
            href: linkHref,
            image: local,
          });
        }
      }
    } else if (cls.includes("elementor-widget-image")) {
      $w.find("img").each((_, el) => {
        const src = $(el).attr("src") || $(el).attr("data-src");
        if (src) {
          const local = rewriteAssetUrl(src);
          if (local) {
            const alt = $(el).attr("alt") || "";
            parts.push(
              `<figure class="content-image"><img src="${local}" alt="${alt}"></figure>`
            );
            if (!images.includes(local)) images.push(local);
          }
        }
      });
    } else if (cls.includes("elementor-widget-gallery")) {
      $w.find(".e-gallery-image").each((_, el) => {
        const thumb =
          $(el).attr("data-thumbnail") ||
          $(el)
            .css("background-image")
            ?.replace(/url\(['"]?(.*?)['"]?\)/, "$1");
        if (thumb) {
          const local = rewriteAssetUrl(thumb);
          if (local) {
            parts.push(
              `<figure class="content-image"><img src="${local}" alt=""></figure>`
            );
            if (!images.includes(local)) images.push(local);
          }
        }
      });
    } else if (cls.includes("elementor-widget-icon-box")) {
      const title = $w.find(".elementor-icon-box-title").text().trim();
      const desc = $w
        .find(".elementor-icon-box-description")
        .text()
        .trim();
      if (title || desc) {
        parts.push(`<h3>${title}</h3>`);
        if (desc) parts.push(`<p>${desc}</p>`);
      }
    } else if (cls.includes("elementor-widget-testimonial")) {
      const content = $w
        .find(".elementor-testimonial-content")
        .text()
        .trim();
      const name = $w.find(".elementor-testimonial-name").text().trim();
      const job = $w.find(".elementor-testimonial-job").text().trim();
      if (content) {
        let footer = name;
        if (job) footer += `, ${job}`;
        parts.push(
          `<blockquote><p>${content}</p><footer>${footer}</footer></blockquote>`
        );
      }
    } else if (cls.includes("elementor-widget-divider")) {
      parts.push("<hr>");
    } else if (cls.includes("elementor-widget-button")) {
      const $a = $w.find("a.elementor-button").first();
      if ($a.length) {
        const href = rewriteInternalUrl($a.attr("href")) || $a.attr("href") || "#";
        const text = $a.text().trim();
        if (text) parts.push(`<p><a href="${href}" class="btn-primary">${text}</a></p>`);
      }
    } else if (cls.includes("elementor-widget-icon-list")) {
      const items = [];
      $w.find(".elementor-icon-list-item").each((_, el) => {
        const text = $(el).text().trim();
        if (text) items.push(`<li>${text}</li>`);
      });
      if (items.length) parts.push(`<ul>${items.join("")}</ul>`);
    }
  });

  // 如果 Elementor widget 提取为空，回退到原始 main 内容清理
  if (parts.length === 0) {
    const root = mainContainer.clone();
    root
      .find(
        "script,style,noscript,iframe,link,meta,nav,header,footer,form,.elementor-location-header,.elementor-location-footer,.woocommerce-breadcrumb,.skip-link,.screen-reader-text,.hfe-nav-menu"
      )
      .remove();
    root.find("*").each((_, el) => {
      const tag = el.tagName?.toLowerCase();
      for (const attr of Object.keys(el.attribs || {})) {
        if (!["href", "src", "alt", "colspan", "rowspan"].includes(attr)) {
          $(el).removeAttr(attr);
        }
      }
      if (tag === "img") {
        const src = $(el).attr("src");
        if (src) {
          const local = rewriteAssetUrl(src);
          if (local) {
            $(el).attr("src", local);
            if (!images.includes(local)) images.push(local);
          }
        }
      }
    });
    const html = (root.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/<p>\s*<\/p>/g, "")
      .trim();
    if (html) parts.push(html);
  }

  const contentHtml = parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return { contentHtml, images, imageBoxCards };
}

/* ── 列表页（WooCommerce 产品列表）提取 ───────────────── */

function extractListingProducts($) {
  const products = [];
  $("ul.products > li.product, ul.products li.product").each((_, el) => {
    const $el = $(el);
    const $link = $el.find("a.woocommerce-LoopProduct-link").first();
    const href = $link.attr("href");
    const title = $link.find("h2.woocommerce-loop-product__title").text().trim();
    const $img = $link.find("img").first();
    const imgSrc = $img.attr("src") || $img.attr("data-src");
    const localImg = imgSrc ? rewriteAssetUrl(imgSrc) : null;

    if (href && title) {
      const internal = rewriteInternalUrl(href);
      products.push({
        title,
        href: internal || href,
        image: localImg || "",
      });
    }
  });
  return products;
}

/* ── 主流程 ────────────────────────────────────────────── */

/**
 * 为部分页面补回退内容 / 修正 Hero 图。
 * 这些页面的源 HTML 内容空洞或缺少合适的预览图。
 */
function applyPageOverrides(entry) {
  // refund-and-returns-policy: 源站内容仅 h1，回退为标准退款政策
  if (entry.path === "/refund-and-returns-policy/") {
    entry.fallbackContent = `<p>Thank you for shopping at Wuxi Sharing Machinery Co., Ltd. We want you to be completely satisfied with your purchase of commercial and industrial laundry equipment. Please review our refund and return policy below.</p>

<h2>Eligibility for Returns</h2>
<p>Due to the nature of commercial laundry equipment, most items are manufactured to order or shipped directly from our factory. Returns are accepted only under the following conditions:</p>
<ul>
  <li>The item is defective on arrival (DOA) or damaged in transit.</li>
  <li>The item is materially different from the specifications listed in the signed sales contract or quotation.</li>
  <li>A return authorization (RMA) is issued by our after-sales team within 7 days of delivery.</li>
</ul>

<h2>Non-Returnable Items</h2>
<ul>
  <li>Custom-built machines produced to your specifications.</li>
  <li>Items that have been installed, used, or modified after delivery.</li>
  <li>Consumables, spare parts, and accessories that have been opened.</li>
  <li>Items returned without original packaging, manuals, or accessories.</li>
</ul>

<h2>Return Process</h2>
<ol>
  <li>Contact our after-sales team at <a href="mailto:info@sharinglaundry.com">info@sharinglaundry.com</a> or call +86-51066206136 within 7 days of receiving your order.</li>
  <li>Provide your order number, the reason for return, and photos / videos of the issue.</li>
  <li>Once your RMA is approved, we will share return shipping instructions.</li>
  <li>After our engineers inspect the item, we will arrange a replacement, repair, or refund as appropriate.</li>
</ol>

<h2>Refunds</h2>
<p>Approved refunds are credited back to the original payment method within 10–20 business days after we receive and inspect the returned item. Shipping, customs duties, and installation costs are non-refundable unless the return is due to our error.</p>

<h2>Damaged or Defective on Arrival</h2>
<p>If your equipment arrives damaged or defective, please refuse the delivery or contact us within 48 hours. We will arrange a free replacement part or a brand-new unit, along with compensation for any reasonable repair costs.</p>

<h2>Contact Us</h2>
<p>If you have any questions about your order, our refund policy, or your warranty coverage, please reach out to us at <a href="mailto:info@sharinglaundry.com">info@sharinglaundry.com</a>. Our after-sales team is available Monday to Saturday, 09:00–18:00 (Beijing time).</p>`;
    if (!entry.image || /250X100|site-logo/i.test(entry.image)) {
      entry.image = "/wp-assets/uploads/img-bg-laundry.jpg";
    }
  }

  // contact-us: 源站 Hero 仅为 logo，改为 contact 背景图
  if (entry.path === "/contact-us/") {
    if (!entry.image || /250X100|site-logo/i.test(entry.image)) {
      entry.image = "/wp-assets/uploads/img-bg-contact.jpg";
    }
  }

  // application: 源站首图为 logo，改为第一张 image-box 图
  if (entry.path === "/application/") {
    if (entry.imageBoxCards && entry.imageBoxCards.length > 0) {
      entry.image = entry.imageBoxCards[0].image;
    }
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const entries = [];
  const failures = [];

  for (const row of manifest) {
    const htmlFile = path.join(SOURCE_HTML_DIR, urlToHtmlFile(row.url));
    let html;
    try {
      html = await readFile(htmlFile, "utf8");
    } catch (err) {
      failures.push({ url: row.url, error: `File not found: ${htmlFile}` });
      continue;
    }

    const $ = cheerio.load(html);
    const pathname = toPathname(row.url);
    const kind = classify(row.url, row.sitemap);
    const slug = slugFromPath(pathname);
    const title = extractTitle($);
    const description =
      getMeta($, "description") || makeExcerpt($("body").text() || title);
    const dates = extractJsonLdDates($);
    const datePublished =
      dates.datePublished?.slice(0, 10) || extractDateFromUrl(row.url);
    const dateModified = dates.dateModified?.slice(0, 10) || "";
    const allImages = extractAllImages($);

    let contentHtml = "";
    let techTableHtml = "";
    let listingProducts = [];
    let imageBoxCards = [];
    let images = allImages;

    if (kind === "product") {
      const result = extractProductPage($);
      contentHtml = result.contentHtml;
      techTableHtml = result.techTableHtml;
      images = result.images.length ? result.images : allImages;
    } else if (kind === "home") {
      // 首页内容由 index.astro 的组件渲染，不需要 contentHtml
      contentHtml = "";
    } else {
      const result = extractElementorContent($);
      contentHtml = result.contentHtml;
      imageBoxCards = result.imageBoxCards;
      images = result.images.length ? result.images : allImages;
      // 列表页提取产品卡片
      if (
        kind === "productCategory" ||
        kind === "shop" ||
        pathname.startsWith("/products/")
      ) {
        listingProducts = extractListingProducts($);
      }
    }

    const excerpt = makeExcerpt(contentHtml || description);

    const entry = {
      id: slug.replace(/[^\w-]+/g, "-"),
      kind,
      sourceUrl: row.url,
      path: pathname,
      slug,
      title,
      description,
      datePublished,
      dateModified,
      image: images[0] || "",
      images,
      excerpt,
      contentHtml,
      plainText: contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      sitemapSource: row.sitemap,
    };

    // 为产品页添加技术参数表字段
    if (techTableHtml) {
      entry.techTableHtml = techTableHtml;
    }

    // 为包含 image-box 组件的页面添加 cards
    if (imageBoxCards.length) {
      entry.imageBoxCards = imageBoxCards;
    }

    // 为列表页添加产品卡片数据
    if (listingProducts.length) {
      entry.listingProducts = listingProducts;
    }

    // 移除 contentHtml 起始处的 h1（避免与模板 <h1> 重复）
    entry.contentHtml = stripLeadingH1(contentHtml, title);

    // 按路径补一些回退/覆盖（源站空白或 Hero 图缺位）
    applyPageOverrides(entry);

    entries.push(entry);
  }

  // 统计
  const counts = entries.reduce((acc, e) => {
    acc[e.kind] = (acc[e.kind] || 0) + 1;
    return acc;
  }, {});

  // 收集资产信息（复用现有）
  const existingData = JSON.parse(
    await readFile(OUT_PATH, "utf8").catch(() => '{"assets":[]}')
  );

  const data = {
    generatedAt: new Date().toISOString(),
    source: SITE,
    counts,
    entries,
    assets: existingData.assets || [],
    failed: failures,
  };

  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n");

  // 输出摘要
  const stats = {
    total: entries.length,
    withContent: entries.filter((e) => e.contentHtml.length > 0).length,
    withTechTable: entries.filter((e) => e.techTableHtml).length,
    withListing: entries.filter((e) => e.listingProducts?.length).length,
    failed: failures.length,
    counts,
  };
  console.log(JSON.stringify(stats, null, 2));

  if (failures.length) {
    console.error("\nFailed files:");
    for (const f of failures) {
      console.error(`  ${f.url}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
