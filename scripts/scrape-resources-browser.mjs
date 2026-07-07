import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const SITE = "https://www.sharinglaundry.com";
const manifestPath = path.join(rootDir, "docs", "research", "url-manifest.json");
const htmlDir = path.join(rootDir, "docs", "research", "source-html");
const assetDir = path.join(rootDir, "public", "wp-assets");
const reportPath = path.join(rootDir, "docs", "research", "RESOURCE_SCRAPE_REPORT.md");
const assetIndexPath = path.join(rootDir, "docs", "research", "source-assets.json");
const runsDir = path.join(rootDir, "docs", "research", "resource-scrape-runs");
const maxPages = Number(process.env.SCRAPE_MAX_PAGES || "0");
const startPage = Math.max(0, Number(process.env.SCRAPE_START || "0"));
const pageConcurrency = Number(process.env.SCRAPE_PAGE_CONCURRENCY || "1");
const assetConcurrency = Number(process.env.SCRAPE_ASSET_CONCURRENCY || "3");
const pageDelayMs = Number(process.env.SCRAPE_DELAY_MS || "2500");
const pageRetries = Number(process.env.SCRAPE_PAGE_RETRIES || "2");
const forcePages = process.env.SCRAPE_FORCE === "1";
const includePattern = process.env.SCRAPE_INCLUDE ? new RegExp(process.env.SCRAPE_INCLUDE, "i") : null;
const requestTimeoutMs = 45000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function safeNameFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  const pathname = url.pathname === "/" ? "/home/" : url.pathname;
  return pathname.replace(/^\/|\/$/g, "").replace(/[^\w.-]+/g, "__") || "home";
}

function htmlFileForUrl(rawUrl) {
  return path.join(htmlDir, `${safeNameFromUrl(rawUrl)}.html`);
}

async function hasReusableHtml(rawUrl) {
  if (forcePages) return false;
  try {
    const existing = await stat(htmlFileForUrl(rawUrl));
    return existing.size > 0;
  } catch {
    return false;
  }
}

function normalizeUrl(rawUrl, base = SITE) {
  const url = new URL(rawUrl, base);
  url.hash = "";
  if (url.hostname === "sharinglaundry.com") url.hostname = "www.sharinglaundry.com";
  return url.toString();
}

function toAsset(rawUrl, base = SITE) {
  try {
    const url = new URL(rawUrl, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname.endsWith("sharinglaundry.com")) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (!/\.(avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?|mp4|webm)$/i.test(pathname)) {
      return null;
    }
    const cleanedPath = pathname
      .replace(/^\/wp-content\//, "")
      .replace(/^\/wp-includes\//, "wp-includes/");
    const localRel = cleanedPath
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/[^\w.-]+/g, "-"))
      .join("/");
    const extension = path.extname(pathname).toLowerCase();
    const kind = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".ico"].includes(extension)
      ? "image"
      : [".woff", ".woff2"].includes(extension)
        ? "font"
        : [".mp4", ".webm"].includes(extension)
          ? "video"
          : extension === ".css"
            ? "css"
            : extension === ".js"
              ? "js"
              : "other";
    return {
      sourceUrl: url.toString(),
      localFile: path.join(assetDir, localRel),
      publicPath: `/wp-assets/${localRel.replaceAll("\\", "/")}`,
      kind,
    };
  } catch {
    return null;
  }
}

function extractAssetsFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const urls = new Set();

  $("img, source").each((_, el) => {
    for (const attr of ["src", "data-src", "data-lazy-src"]) {
      const value = $(el).attr(attr);
      if (value) urls.add(normalizeUrl(value, pageUrl));
    }
    for (const attr of ["srcset", "data-srcset", "data-lazy-srcset"]) {
      const value = $(el).attr(attr);
      if (!value) continue;
      for (const part of value.split(",")) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) urls.add(normalizeUrl(candidate, pageUrl));
      }
    }
  });

  $("link").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase();
    const href = $(el).attr("href");
    if (href && /stylesheet|icon|preload|font|manifest/.test(rel)) {
      urls.add(normalizeUrl(href, pageUrl));
    }
  });

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && /wp-content|wp-includes/.test(src)) urls.add(normalizeUrl(src, pageUrl));
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    for (const match of style.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
      if (match[2]) urls.add(normalizeUrl(match[2], pageUrl));
    }
  });

  for (const match of html.matchAll(/https?:\/\/www\.sharinglaundry\.com\/[^"'()\s]+\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?|mp4|webm)/gi)) {
    urls.add(normalizeUrl(match[0], pageUrl));
  }

  return [...urls].map((url) => toAsset(url, pageUrl)).filter(Boolean);
}

function extractAssetsFromCss(css, cssUrl) {
  const urls = new Set();
  for (const match of css.matchAll(/url\((['"]?)(.*?)\1\)/gi)) {
    const value = match[2];
    if (value && !value.startsWith("data:")) urls.add(normalizeUrl(value, cssUrl));
  }
  return [...urls].map((url) => toAsset(url, cssUrl)).filter(Boolean);
}

async function fetchPage(context, row) {
  const htmlFile = htmlFileForUrl(row.url);
  if (!forcePages) {
    try {
      const existing = await stat(htmlFile);
      if (existing.size > 0) {
        const html = await readFile(htmlFile, "utf8");
        const $ = cheerio.load(html);
        return {
          ok: true,
          row,
          html,
          title: $("title").first().text().trim(),
          status: 0,
          htmlFile,
          reused: true,
        };
      }
    } catch {
      // No reusable HTML cache.
    }
  }

  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font", "stylesheet", "script"].includes(type)) {
      return route.abort().catch(() => {});
    }
    return route.continue().catch(() => {});
  });

  try {
    let lastError;
    for (let attempt = 1; attempt <= pageRetries + 1; attempt++) {
      try {
        const response = await page.goto(row.url, { waitUntil: "commit", timeout: requestTimeoutMs });
        await page.waitForTimeout(1200);
        const html = await page.content();
        const title = await page.title();
        const status = response?.status() || 0;
        await writeFile(htmlFile, html);
        return { ok: true, row, html, title, status, htmlFile, reused: false, attempts: attempt };
      } catch (error) {
        lastError = error;
        if (attempt <= pageRetries) {
          await sleep(pageDelayMs * attempt);
        }
      }
    }
    throw lastError;
  } catch (error) {
    return { ok: false, row, error: error.message };
  } finally {
    await page.close().catch(() => {});
  }
}

async function downloadAsset(request, asset) {
  try {
    await mkdir(path.dirname(asset.localFile), { recursive: true });
    try {
      const existing = await stat(asset.localFile);
      if (existing.size > 0) {
        return { ...asset, ok: true, bytes: existing.size, skipped: true };
      }
    } catch {
      // No local file yet.
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await request.get(asset.sourceUrl, {
          timeout: requestTimeoutMs,
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            referer: SITE,
          },
        });
        if (!response.ok()) throw new Error(`${response.status()} ${response.statusText()}`);
        const body = await response.body();
        await writeFile(asset.localFile, body);
        return { ...asset, ok: true, bytes: body.length, skipped: false };
      } catch (error) {
        lastError = error;
        await sleep(600 * attempt);
      }
    }
    throw lastError;
  } catch (error) {
    return { ...asset, ok: false, error: error.message };
  }
}

async function main() {
  await mkdir(htmlDir, { recursive: true });
  await mkdir(assetDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const filteredRows = includePattern
    ? manifest.filter((row) => includePattern.test(row.url) || includePattern.test(row.sitemap || ""))
    : manifest;
  const rows = maxPages > 0 ? filteredRows.slice(startPage, startPage + maxPages) : filteredRows.slice(startPage);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-http2"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });

  let liveFetchCount = 0;
  const pageResults = await mapLimit(rows, pageConcurrency, async (row) => {
    const willFetchLive = !(await hasReusableHtml(row.url));
    if (willFetchLive && liveFetchCount > 0 && pageDelayMs > 0) {
      await sleep(pageDelayMs + Math.floor(Math.random() * 900));
    }
    if (willFetchLive) liveFetchCount++;
    return fetchPage(context, row);
  });
  const successfulPages = pageResults.filter((result) => result.ok);
  const failedPages = pageResults.filter((result) => !result.ok);
  const reusedPages = successfulPages.filter((result) => result.reused);
  const fetchedPages = successfulPages.filter((result) => !result.reused);

  const assetMap = new Map();
  for (const result of successfulPages) {
    for (const asset of extractAssetsFromHtml(result.html, result.row.url)) {
      assetMap.set(asset.sourceUrl, asset);
    }
  }

  let assets = [...assetMap.values()];
  const firstPass = await mapLimit(assets, assetConcurrency, (asset) => downloadAsset(context.request, asset));

  const cssAssets = firstPass.filter((asset) => asset.ok && asset.kind === "css");
  for (const asset of cssAssets) {
    try {
      const css = await readFile(asset.localFile, "utf8");
      for (const nested of extractAssetsFromCss(css, asset.sourceUrl)) {
        if (!assetMap.has(nested.sourceUrl)) assetMap.set(nested.sourceUrl, nested);
      }
    } catch {
      // Ignore binary or unreadable CSS edge cases.
    }
  }

  assets = [...assetMap.values()];
  const secondPassTargets = assets.filter((asset) => !firstPass.some((item) => item.sourceUrl === asset.sourceUrl));
  const secondPass = await mapLimit(secondPassTargets, assetConcurrency, (asset) => downloadAsset(context.request, asset));
  await context.close();
  await browser.close();

  const downloads = [...firstPass, ...secondPass];
  const generatedAt = new Date().toISOString();
  const indexPayload = {
    generatedAt,
    scope: {
      start: startPage,
      limit: maxPages || null,
      include: process.env.SCRAPE_INCLUDE || null,
      force: forcePages,
      filteredTotal: filteredRows.length,
    },
    pages: {
      selected: rows.length,
      ok: successfulPages.length,
      fetched: fetchedPages.length,
      reused: reusedPages.length,
      failed: failedPages.length,
    },
        assets: {
          discovered: assets.length,
          downloaded: downloads.filter((asset) => asset.ok).length,
          failed: downloads.filter((asset) => !asset.ok).length,
        },
        pageResults: pageResults.map((result) =>
          result.ok
            ? {
                ok: true,
                url: result.row.url,
                title: result.title,
                status: result.status,
                reused: Boolean(result.reused),
                attempts: result.attempts || 0,
                htmlFile: path.relative(rootDir, result.htmlFile).replaceAll("\\", "/"),
              }
            : { ok: false, url: result.row.url, error: result.error }
        ),
        downloads: downloads.map((asset) => ({
          sourceUrl: asset.sourceUrl,
          publicPath: asset.publicPath,
          kind: asset.kind,
          ok: asset.ok,
          bytes: asset.bytes || 0,
          skipped: Boolean(asset.skipped),
          error: asset.error || "",
        })),
      };

  await writeFile(assetIndexPath, `${JSON.stringify(indexPayload, null, 2)}\n`);
  await writeFile(
    path.join(runsDir, `${generatedAt.replace(/[:.]/g, "-")}.json`),
    `${JSON.stringify(indexPayload, null, 2)}\n`
  );

  const byKind = downloads.reduce((acc, asset) => {
    const key = `${asset.kind}:${asset.ok ? "ok" : "failed"}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  await writeFile(
    reportPath,
    [
      "# Resource Scrape Report",
      "",
      `- Generated: ${generatedAt}`,
      `- Source: ${SITE}`,
      `- Filtered manifest rows: ${filteredRows.length}`,
      `- Pages selected this run: ${rows.length}`,
      `- Pages fetched from source: ${fetchedPages.length}`,
      `- Pages reused from local cache: ${reusedPages.length}`,
      `- Pages cached total in this run scope: ${successfulPages.length}`,
      `- Pages failed: ${failedPages.length}`,
      `- Assets discovered: ${assets.length}`,
      `- Assets available locally: ${downloads.filter((asset) => asset.ok).length}`,
      `- Asset failures: ${downloads.filter((asset) => !asset.ok).length}`,
      "",
      "## Asset Counts",
      "",
      ...Object.entries(byKind).map(([kind, count]) => `- ${kind}: ${count}`),
      "",
      "## Failed Pages",
      "",
      ...(failedPages.length
        ? failedPages.map((item) => `- ${item.row.url}: ${item.error}`)
        : ["- None"]),
      "",
      "## Failed Assets",
      "",
      ...downloads
        .filter((asset) => !asset.ok)
        .slice(0, 80)
        .map((asset) => `- ${asset.sourceUrl}: ${asset.error}`),
      downloads.filter((asset) => !asset.ok).length > 80 ? "- Additional failures omitted from report; see source-assets.json." : "",
      "",
    ].join("\n")
  );

  console.log(
    JSON.stringify(
      {
        pagesAttempted: rows.length,
        pagesCached: successfulPages.length,
        pagesFetched: fetchedPages.length,
        pagesReused: reusedPages.length,
        pagesFailed: failedPages.length,
        assetsDiscovered: assets.length,
        assetsLocal: downloads.filter((asset) => asset.ok).length,
        assetFailures: downloads.filter((asset) => !asset.ok).length,
        byKind,
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
