import * as cheerio from "cheerio";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const SITE = "https://www.sharinglaundry.com";
const SITEMAP_INDEX = `${SITE}/sitemap_index.xml`;
const OUT_DATA = path.join(rootDir, "src", "data", "site-data.json");
const RESEARCH_DIR = path.join(rootDir, "docs", "research");
const DESIGN_DIR = path.join(rootDir, "docs", "design-references");
const PUBLIC_DIR = path.join(rootDir, "public");
const ASSET_DIR = path.join(PUBLIC_DIR, "wp-assets");
const MAX_ASSET_DOWNLOADS = 4;
const MAX_PAGE_FETCHES = 4;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;

const skipPathPatterns = [
  /^\/author\//,
  /^\/cart\/?$/,
  /^\/checkout\/?$/,
  /^\/my-account\/?$/,
  /^\/wishlist\/?$/,
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; SharingLaundryStaticMigration/1.0; +https://www.sharinglaundry.com)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(500 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function normalizeUrl(raw) {
  const url = new URL(raw, SITE);
  url.hash = "";
  if (url.hostname === "sharinglaundry.com") {
    url.hostname = "www.sharinglaundry.com";
  }
  return url.toString();
}

function toPathname(raw) {
  const url = new URL(raw);
  let pathname = url.pathname || "/";
  if (!pathname.endsWith("/")) pathname += "/";
  return pathname;
}

function classify(url, sitemapSource) {
  const pathname = toPathname(url);
  if (pathname === "/") return "home";
  if (pathname === "/shop/") return "shop";
  if (pathname.startsWith("/product/")) return "product";
  if (pathname.startsWith("/product-category/")) return "productCategory";
  if (pathname.startsWith("/category/")) return "category";
  if (sitemapSource.includes("post-sitemap")) return "post";
  return "page";
}

function shouldSkip(url) {
  const pathname = toPathname(url);
  return skipPathPatterns.some((pattern) => pattern.test(pathname));
}

function slugFromPath(pathname) {
  return pathname.replace(/^\/|\/$/g, "") || "home";
}

function absoluteToPublicAsset(src) {
  try {
    const url = new URL(src, SITE);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname.endsWith("sharinglaundry.com")) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (!/\.(avif|gif|ico|jpe?g|png|svg|webp|woff2?|mp4|webm)$/i.test(pathname)) return null;
    const cleanedPath = pathname
      .replace(/^\/wp-content\//, "")
      .replace(/^\/wp-includes\//, "wp-includes/");
    const safePath = cleanedPath
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/[^\w.-]+/g, "-"))
      .join("/");
    return {
      sourceUrl: url.toString(),
      localFile: path.join(ASSET_DIR, safePath),
      publicPath: `/wp-assets/${safePath.replaceAll("\\", "/")}`,
      kind: /\.(avif|gif|ico|jpe?g|png|svg|webp)$/i.test(pathname)
        ? "image"
        : /\.(mp4|webm)$/i.test(pathname)
          ? "video"
          : /\.(woff2?)$/i.test(pathname)
            ? "other"
            : "other",
    };
  } catch {
    return null;
  }
}

function extractAssetUrls($) {
  const urls = new Set();
  $("img, source").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src) urls.add(new URL(src, SITE).toString());
    const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
    if (srcset) {
      for (const part of srcset.split(",")) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) urls.add(new URL(candidate, SITE).toString());
      }
    }
  });
  $("video").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("poster");
    if (src) urls.add(new URL(src, SITE).toString());
  });
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
      if (match[2]) urls.add(new URL(match[2], SITE).toString());
    }
  });
  $("link[rel*='icon']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) urls.add(new URL(href, SITE).toString());
  });
  return [...urls].map(absoluteToPublicAsset).filter(Boolean);
}

function rewriteUrlAttribute(value, assetMap) {
  if (!value) return value;
  try {
    const absolute = new URL(value, SITE).toString();
    const asset = assetMap.get(absolute);
    if (asset) return asset.publicPath;
    const url = new URL(absolute);
    if (url.hostname.endsWith("sharinglaundry.com")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }
  return value;
}

function cleanupHtml($, assetMap) {
  const root =
    $("main").first().length > 0
      ? $("main").first().clone()
      : $("article").first().length > 0
        ? $("article").first().clone()
        : $("body").clone();

  root
    .find(
      "script,style,noscript,iframe[src*='google'],link,meta,nav,header,footer,.elementor-location-header,.elementor-location-footer,.woocommerce-breadcrumb,.skip-link,.screen-reader-text"
    )
    .remove();

  root.find("form").each((_, el) => {
    const replacement = "<p><strong>Send Your Inquiry</strong></p>";
    $(el).replaceWith(replacement);
  });

  root.find("*").each((_, el) => {
    const node = $(el);
    const tag = el.tagName?.toLowerCase();
    for (const attr of Object.keys(el.attribs || {})) {
      if (["href", "src", "alt", "title", "colspan", "rowspan"].includes(attr)) continue;
      if (attr === "srcset") continue;
      node.removeAttr(attr);
    }
    if (tag === "a") {
      node.attr("href", rewriteUrlAttribute(node.attr("href"), assetMap));
    }
    if (tag === "img") {
      node.attr("src", rewriteUrlAttribute(node.attr("src"), assetMap));
      node.removeAttr("srcset");
      node.removeAttr("sizes");
      if (!node.attr("alt")) node.attr("alt", "");
      const parentText = node.parent().text().trim();
      if (!parentText && node.parent().children().length === 1) {
        node.parent().addClass("content-image");
      }
    }
  });

  const html = root.html() || "";
  return html
    .replace(/\n{3,}/g, "\n\n")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
}

function textPreview($) {
  const clone = $("main").first().length ? $("main").first().clone() : $("body").clone();
  clone.find("script,style,noscript,nav,header,footer,form").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

function getMeta($, name) {
  return (
    $(`meta[name='${name}']`).attr("content") ||
    $(`meta[property='og:${name}']`).attr("content") ||
    ""
  ).trim();
}

function extractTitle($) {
  return (
    $("meta[property='og:title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    "Untitled"
  )
    .replace(/\s+-\s+Wuxi Sharing Machinery Co.,Ltd\s*$/i, "")
    .trim();
}

function extractJsonLdDates($) {
  const dates = {};
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const value = JSON.parse($(el).text());
      const nodes = Array.isArray(value) ? value : [value, ...(value["@graph"] || [])];
      for (const node of nodes) {
        if (node?.datePublished && !dates.datePublished) dates.datePublished = node.datePublished;
        if (node?.dateModified && !dates.dateModified) dates.dateModified = node.dateModified;
      }
    } catch {
      // Ignore malformed or plugin-generated JSON-LD fragments.
    }
  });
  return dates;
}

async function getSitemapUrls() {
  const indexXml = await fetchText(SITEMAP_INDEX);
  const $index = cheerio.load(indexXml, { xmlMode: true });
  const sitemapUrls = [];
  $index("sitemap > loc").each((_, el) => sitemapUrls.push($index(el).text().trim()));

  const rows = [];
  for (const sitemap of sitemapUrls) {
    const xml = await fetchText(sitemap);
    const $ = cheerio.load(xml, { xmlMode: true });
    $("url > loc").each((_, el) => {
      const url = normalizeUrl($(el).text().trim());
      if (!shouldSkip(url)) {
        rows.push({ url, sitemap });
      }
    });
  }

  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.url)) {
      seen.set(row.url, row);
    }
  }
  return [...seen.values()];
}

async function downloadAsset(asset) {
  try {
    await mkdir(path.dirname(asset.localFile), { recursive: true });
    try {
      const existing = await stat(asset.localFile);
      if (existing.size > 0) {
        return {
          sourceUrl: asset.sourceUrl,
          localPath: asset.publicPath,
          kind: asset.kind,
          ok: true,
          bytes: existing.size,
        };
      }
    } catch {
      // File does not exist yet.
    }
    let downloaded = null;
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(asset.sourceUrl, {
          signal: controller.signal,
          headers: { "user-agent": "SharingLaundryStaticMigration/1.0" },
        });
        if (!response.ok || !response.body) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        await pipeline(response.body, createWriteStream(asset.localFile));
        downloaded = await stat(asset.localFile);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await sleep(500 * attempt);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!downloaded) {
      throw lastError;
    }
    return {
      sourceUrl: asset.sourceUrl,
      localPath: asset.publicPath,
      kind: asset.kind,
      ok: true,
      bytes: downloaded.size,
    };
  } catch (error) {
    return {
      sourceUrl: asset.sourceUrl,
      localPath: asset.publicPath,
      kind: asset.kind,
      ok: false,
      error: error.message,
    };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function countsByKind(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  await mkdir(RESEARCH_DIR, { recursive: true });
  await mkdir(path.join(RESEARCH_DIR, "components"), { recursive: true });
  await mkdir(DESIGN_DIR, { recursive: true });
  await mkdir(ASSET_DIR, { recursive: true });

  const manifest = await getSitemapUrls();
  await writeFile(
    path.join(RESEARCH_DIR, "url-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  const pageResults = await mapLimit(manifest, MAX_PAGE_FETCHES, async (row) => {
    try {
      const html = await fetchText(row.url);
      return { ok: true, page: { ...row, html } };
    } catch (error) {
      return { ok: false, failure: { url: row.url, error: error.message } };
    }
  });
  const fetchedPages = pageResults.filter((result) => result.ok).map((result) => result.page);
  const failed = pageResults
    .filter((result) => !result.ok)
    .map((result) => result.failure);

  const allAssets = new Map();
  for (const page of fetchedPages) {
    const $ = cheerio.load(page.html);
    for (const asset of extractAssetUrls($)) {
      if (!allAssets.has(asset.sourceUrl)) allAssets.set(asset.sourceUrl, asset);
    }
  }

  const assets = await mapLimit([...allAssets.values()], MAX_ASSET_DOWNLOADS, downloadAsset);
  const assetMap = new Map([...allAssets.values()].map((asset) => [asset.sourceUrl, asset]));

  const entries = fetchedPages.map((page) => {
    const $ = cheerio.load(page.html);
    const pathname = toPathname(page.url);
    const dates = extractJsonLdDates($);
    const images = extractAssetUrls($)
      .filter((asset) => asset.kind === "image")
      .map((asset) => asset.publicPath);
    const uniqueImages = [...new Set(images)];
    const plainText = textPreview($);
    const description =
      getMeta($, "description") ||
      plainText.split(" ").slice(0, 32).join(" ");

    return {
      id: slugFromPath(pathname).replace(/[^\w-]+/g, "-"),
      kind: classify(page.url, page.sitemap),
      sourceUrl: page.url,
      path: pathname,
      slug: slugFromPath(pathname),
      title: extractTitle($),
      description,
      datePublished: dates.datePublished || "",
      dateModified: dates.dateModified || "",
      image: uniqueImages[0] || "",
      images: uniqueImages,
      excerpt: plainText.slice(0, 220),
      contentHtml: cleanupHtml($, assetMap),
      plainText,
      sitemapSource: page.sitemap,
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    source: SITE,
    counts: countsByKind(entries),
    entries,
    assets,
    failed,
  };

  await writeFile(OUT_DATA, `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(
    path.join(RESEARCH_DIR, "MIGRATION_REPORT.md"),
    [
      "# Migration Report",
      "",
      `- Generated: ${data.generatedAt}`,
      `- Source: ${SITE}`,
      `- Manifest URLs: ${manifest.length}`,
      `- Entries migrated: ${entries.length}`,
      `- Assets discovered: ${assets.length}`,
      `- Assets downloaded: ${assets.filter((asset) => asset.ok).length}`,
      `- Failed pages: ${failed.length}`,
      "",
      "## Counts",
      "",
      ...Object.entries(data.counts).map(([kind, count]) => `- ${kind}: ${count}`),
      "",
      "## Failed Pages",
      "",
      ...(failed.length ? failed.map((item) => `- ${item.url}: ${item.error}`) : ["- None"]),
      "",
    ].join("\n")
  );

  console.log(
    JSON.stringify(
      {
        manifest: manifest.length,
        entries: entries.length,
        assets: assets.length,
        downloaded: assets.filter((asset) => asset.ok).length,
        failed: failed.length,
        counts: data.counts,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
