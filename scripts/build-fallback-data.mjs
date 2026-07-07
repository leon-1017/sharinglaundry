import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "docs", "research", "url-manifest.json");
const outPath = path.join(rootDir, "src", "data", "site-data.json");
const assetsDir = path.join(rootDir, "public", "wp-assets");

function toPathname(raw) {
  const url = new URL(raw);
  let pathname = url.pathname || "/";
  if (!pathname.endsWith("/")) pathname += "/";
  return pathname;
}

function slugFromPath(pathname) {
  return pathname.replace(/^\/|\/$/g, "") || "home";
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

function titleize(slug) {
  const lowerWords = new Set(["and", "or", "to", "the", "of", "in", "on", "for", "with", "be", "up"]);
  return slug
    .split("/")
    .at(-1)
    .split("-")
    .filter(Boolean)
    .map((part, index) => {
      if (/^\d+$/.test(part)) return part;
      if (part.length <= 2 && !lowerWords.has(part)) return part.toUpperCase();
      if (index > 0 && lowerWords.has(part)) return part;
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function descriptionFor(kind, title) {
  const base = "Sharing Laundry static migration page.";
  switch (kind) {
    case "product":
      return `${title} product page for commercial and industrial laundry equipment.`;
    case "post":
      return `${title} case study and shipping update from Sharing Laundry.`;
    case "productCategory":
      return `${title} product category overview for laundry machinery solutions.`;
    case "category":
      return `${title} news archive page from Sharing Laundry.`;
    case "shop":
      return "Commercial and industrial laundry equipment catalogue.";
    case "page":
      return `${title} information page from the Sharing Laundry public site.`;
    default:
      return base;
  }
}

function htmlForEntry(kind, title, sourceUrl, pathName) {
  if (pathName === "/about-us/") {
    return `
      <p>Wuxi Sharing Machinery Co.,Ltd is focused on commercial and industrial laundry equipment. This static page preserves the original public site structure while moving the frontend away from WordPress.</p>
      <p>The company catalog covers washer extractors, tumble dryers, flatwork ironers, folders, feeders, dry-cleaning equipment and finishing machines.</p>
    `;
  }
  if (pathName === "/contact-us/") {
    return `
      <p>Contact the team through the inquiry form, WhatsApp or Skype. Static deployment keeps the form client-side for now, with a dedicated API adapter reserved for later integration.</p>
      <ul>
        <li>Email: info@sharinglaundry.com</li>
        <li>Hotline: +86-13606196136 / +86-13861751289</li>
        <li>WhatsApp: +8613606196136</li>
      </ul>
    `;
  }
  if (pathName === "/support/") {
    return `
      <p>Support covers pre-sales planning, configuration advice, installation coordination and after-sales communication for laundry projects.</p>
    `;
  }
  if (pathName === "/application/") {
    return `
      <p>Application pages organize the main use cases served by the product line, including hospitality, healthcare, dry-cleaners, laundry plants and self-service laundry shops.</p>
    `;
  }
  if (pathName.startsWith("/application/")) {
    return `
      <p>${title} is one of the public application pages migrated from the original site.</p>
      <p>This static version keeps the route and frontend presentation stable while the underlying content model moves away from WordPress.</p>
    `;
  }
  if (pathName === "/products/" || pathName === "/shop/") {
    return `
      <p>This catalogue groups the main Sharing Laundry equipment lines. Use the product cards below to browse categories and individual models.</p>
    `;
  }
  if (pathName.startsWith("/products/")) {
    return `
      <p>${title} is a product line page migrated from the original catalogue navigation.</p>
    `;
  }
  if (kind === "product") {
    return `
      <p>${title} is part of the Sharing Laundry commercial equipment range. The route, page identity and catalogue grouping have been preserved for static deployment.</p>
      <p><a href="${sourceUrl}">Reference original WordPress page</a></p>
    `;
  }
  if (kind === "post") {
    return `
      <p>${title} is a news and shipment update carried over from the original public site.</p>
      <p><a href="${sourceUrl}">Reference original WordPress post</a></p>
    `;
  }
  if (kind === "category") {
    return `
      <p>${title} groups public news posts from the original WordPress archive.</p>
    `;
  }
  if (kind === "productCategory") {
    return `
      <p>${title} groups related machine models within the product catalogue.</p>
    `;
  }
  return `
    <p>${title} has been migrated into the new static frontend structure.</p>
    <p><a href="${sourceUrl}">Reference original WordPress page</a></p>
  `;
}

async function walkFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const assetFiles = await walkFiles(assetsDir).catch(() => []);
  const imagePool = assetFiles
    .filter((file) => /\.(png|jpe?g|webp|svg)$/i.test(file))
    .map((file) => `/${path.relative(path.join(rootDir, "public"), file).replaceAll("\\", "/")}`);

  const entries = manifest.map((row, index) => {
    const pathName = toPathname(row.url);
    const kind = classify(row.url, row.sitemap);
    const slug = slugFromPath(pathName);
    const title =
      {
        home: "Home",
        "about-us": "About Us",
        products: "Products",
        news: "News",
        support: "Support",
        application: "Application",
        "contact-us": "Contact Us",
        "refund-and-returns-policy": "Refund And Returns Policy",
        shop: "Shop",
      }[slug] || titleize(slug);

    const postDateMatch = row.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    const image = imagePool.length ? imagePool[index % imagePool.length] : "";

    return {
      id: slug.replace(/[^\w-]+/g, "-"),
      kind,
      sourceUrl: row.url,
      path: pathName,
      slug,
      title,
      description: descriptionFor(kind, title),
      datePublished: postDateMatch
        ? `${postDateMatch[1]}-${postDateMatch[2]}-${postDateMatch[3]}`
        : "",
      dateModified: "",
      image,
      images: image ? [image] : [],
      excerpt: descriptionFor(kind, title),
      contentHtml: htmlForEntry(kind, title, row.url, pathName).trim(),
      plainText: `${title}. ${descriptionFor(kind, title)}`,
      sitemapSource: row.sitemap,
    };
  });

  const counts = entries.reduce((acc, entry) => {
    acc[entry.kind] = (acc[entry.kind] || 0) + 1;
    return acc;
  }, {});

  const data = {
    generatedAt: new Date().toISOString(),
    source: "https://www.sharinglaundry.com",
    counts,
    entries,
    assets: imagePool.map((image) => ({
      sourceUrl: image,
      localPath: image,
      kind: "image",
      ok: true,
    })),
    failed: [],
  };

  await writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(JSON.stringify({ entries: entries.length, images: imagePool.length, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
