import siteData from "../data/site-data.json";
import type { SiteData, SiteEntry } from "../types/content";

const data = siteData as SiteData;
const LOCAL_SITE = "https://www.sharinglaundry.com";

const productCategoryMap: Record<string, { href: string; label: string }> = {
  "coin-operated-washing-machine": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "commercial-washing-machine": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "laundry-washing-machine": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "barrier-washer-extractor": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "tilting-washer-extractor": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "washer-extractor": {
    href: "/product-category/washer-extractors/",
    label: "Washer Extractors",
  },
  "laundry-tumble-dryer": {
    href: "/product-category/tumble-dryers/",
    label: "Tumble Dryers",
  },
  "commercial-tumble-dryer": {
    href: "/product-category/tumble-dryers/",
    label: "Tumble Dryers",
  },
  "stacked-dryer": {
    href: "/product-category/tumble-dryers/",
    label: "Tumble Dryers",
  },
  "commercial-stacked-washer-and-dryer": {
    href: "/product-category/tumble-dryers/",
    label: "Tumble Dryers",
  },
  "roller-flatwork-ironer": {
    href: "/product-category/flatwork-ironers/",
    label: "Flatwork Ironers",
  },
  "chest-flatwork-ironer": {
    href: "/product-category/flatwork-ironers/",
    label: "Flatwork Ironers",
  },
  "towel-folder": {
    href: "/product-category/folders/",
    label: "Folders",
  },
  "laundry-linen-folder": {
    href: "/product-category/folders/",
    label: "Folders",
  },
  "vacuum-feeder": {
    href: "/product-category/feeders/",
    label: "Feeders",
  },
  "automatic-feeder": {
    href: "/product-category/feeders/",
    label: "Feeders",
  },
  "dry-cleaning-machine": {
    href: "/product-category/dry-cleaning-equipment/",
    label: "Dry Cleaning Equipment",
  },
  "form-finisher": {
    href: "/product-category/finishing-equipments/",
    label: "Finishing Equipments",
  },
  "utility-laundry-press": {
    href: "/product-category/finishing-equipments/",
    label: "Finishing Equipments",
  },
  "laundry-press-with-steam-boiler": {
    href: "/product-category/finishing-equipments/",
    label: "Finishing Equipments",
  },
};

const imageOverrides: Record<string, string[]> = {
  home: ["/wp-assets/uploads/SWE25S.png"],
  "product-coin-operated-washing-machine": ["/wp-assets/uploads/Coin-Operated-Washer-01-600x600.jpg"],
  "product-commercial-washing-machine": [
    "/wp-assets/uploads/washer-extractor-1-2-600x600.jpg",
    "/wp-assets/uploads/washer-extractor-3-1-600x600.jpg",
    "/wp-assets/uploads/washer-extractor-2-2-600x600.jpg",
    "/wp-assets/uploads/washer-extractor-4-1-600x600.jpg",
  ],
  "product-laundry-washing-machine": ["/wp-assets/uploads/Washer-Extractor-2-600x600.jpg"],
  "product-barrier-washer-extractor": ["/wp-assets/uploads/Barrier-Washer-Extractor-01-600x600.jpg"],
  "product-tilting-washer-extractor": [
    "/wp-assets/uploads/Tilting-Washer-Extractor-600x600.jpg",
    "/wp-assets/uploads/Tilting-Washer-Extractor-1-600x600.jpg",
  ],
  "product-washer-extractor": [
    "/wp-assets/uploads/Washer-Extractor-10-600x600.jpg",
    "/wp-assets/uploads/Washer-Extractor-1-600x600.jpg",
  ],
  "product-laundry-tumble-dryer": [
    "/wp-assets/uploads/Tumble-Dryer-2-600x600.jpg",
    "/wp-assets/uploads/Tumble-Dryer-21-600x600.jpg",
    "/wp-assets/uploads/Tumble-Dryer-24-600x600.jpg",
  ],
  "product-commercial-tumble-dryer": [
    "/wp-assets/uploads/Tumble-dryer-1-1-600x600.jpg",
    "/wp-assets/uploads/Tumble-dryer-2-2-600x600.jpg",
    "/wp-assets/uploads/Tumble-dryer-3-1-600x600.jpg",
    "/wp-assets/uploads/Tumble-dryer-4-1-600x600.jpg",
  ],
  "product-stacked-dryer": ["/wp-assets/uploads/Stacked-Dryer-2-1-600x600.jpg"],
  "product-commercial-stacked-washer-and-dryer": ["/wp-assets/uploads/Stacked-Dryer-1-2-600x600.jpg"],
  "product-dry-cleaning-machine": ["/wp-assets/uploads/Dry-Cleaning-Machine-2-600x600.jpg"],
  "product-vacuum-feeder": [
    "/wp-assets/uploads/Vacuum-Feeder-600x600.jpg",
    "/wp-assets/uploads/Vacuum-Feeder-1-600x600.jpg",
  ],
  "product-automatic-feeder": ["/wp-assets/uploads/Automatic-Feeder-2-600x600.jpg"],
  "product-form-finisher": ["/wp-assets/uploads/Form-Finisher-1-600x600.jpg"],
  "product-utility-laundry-press": ["/wp-assets/uploads/Laundry-Press-3-600x600.jpg"],
  "product-laundry-press-with-steam-boiler": ["/wp-assets/uploads/Laundry-Press-1-600x600.jpg"],
  "product-towel-folder": [
    "/wp-assets/uploads/Towel-Folder-600x600.jpg",
    "/wp-assets/uploads/Towel-Folder-1-600x600.jpg",
  ],
  "product-laundry-linen-folder": [
    "/wp-assets/uploads/Laundry-Linen-Folder-600x600.jpg",
    "/wp-assets/uploads/Laundry-Linen-Folder-2-600x600.jpg",
  ],
  "product-roller-flatwork-ironer": ["/wp-assets/uploads/Flatwork-Ironer-1-600x600.jpg"],
  "product-chest-flatwork-ironer": ["/wp-assets/uploads/Chest-Flatwork-Ironer-1-600x600.jpg"],
  "page-about-us": ["/wp-assets/uploads/2024-Texcare-picture-1.jpg"],
  "page-contact-us": ["/wp-assets/uploads/img-bg-contact.jpg"],
  "page-support": ["/wp-assets/uploads/img-banner-support.jpg"],
  "page-news": ["/wp-assets/uploads/img-newsbanner.jpg"],
  "page-application": ["/wp-assets/uploads/img-bg-laundry.jpg"],
};

function normalizeSourceUrl(raw: string) {
  try {
    const url = new URL(raw, LOCAL_SITE);
    url.hash = "";
    if (url.hostname === "sharinglaundry.com") url.hostname = "www.sharinglaundry.com";
    return url.toString();
  } catch {
    return raw;
  }
}

const sourcePathMap = new Map(
  data.entries.map((entry) => [normalizeSourceUrl(entry.sourceUrl), entry.path])
);

const assetPathMap = new Map(
  data.assets
    .filter((asset) => asset.ok)
    .map((asset) => [normalizeSourceUrl(asset.sourceUrl), asset.localPath])
);

function rewriteSourceHref(raw: string) {
  const normalized = normalizeSourceUrl(raw);
  return sourcePathMap.get(normalized) || assetPathMap.get(normalized) || raw;
}

function localizeContentHtml(html: string) {
  return html
    .replace(
      /<p>\s*<a href="https:\/\/www\.sharinglaundry\.com\/[^"]+">Reference original WordPress (?:page|post)<\/a>\s*<\/p>/gi,
      ""
    )
    .replace(/(href|src)="([^"]+)"/g, (_, attr, url) => `${attr}="${rewriteSourceHref(url)}"`)
    .trim();
}

function applyEntryOverrides(entry: SiteEntry): SiteEntry {
  const overrideImages = imageOverrides[entry.id];
  const images = overrideImages?.length ? overrideImages : entry.images;
  return {
    ...entry,
    image: images[0] || entry.image,
    images,
    contentHtml: localizeContentHtml(entry.contentHtml),
  };
}

const entries = data.entries.map(applyEntryOverrides);

export function getSiteData() {
  return { ...data, entries };
}

export function getEntries() {
  return entries;
}

export function getEntryByPath(pathname: string) {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return entries.find((entry) => entry.path === normalized);
}

export function getEntriesByKind(kind: SiteEntry["kind"]) {
  return entries.filter((entry) => entry.kind === kind);
}

export function getLatest(kind: SiteEntry["kind"], count: number) {
  return getEntriesByKind(kind)
    .slice()
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
    .slice(0, count);
}

export function getHomeEntry() {
  return getEntryByPath("/")!;
}

export function getProductCollection() {
  return entries.filter((entry) => entry.kind === "product");
}

export function getPostCollection() {
  return entries.filter((entry) => entry.kind === "post");
}

export function getProductCategories() {
  return entries.filter(
    (entry) =>
      entry.kind === "productCategory" ||
      (entry.kind === "page" && entry.path.startsWith("/products/") && entry.path !== "/products/")
  );
}

export function getProductCategory(entry: SiteEntry) {
  return productCategoryMap[entry.slug] || { href: "/product-category/washer-extractors/", label: "Washer Extractors" };
}

function categoryKeywords(pathname: string) {
  if (pathname.includes("washer-extractors")) return ["washer", "washing", "coin-operated", "barrier", "tilting"];
  if (pathname.includes("tumble-dryers")) return ["dryer", "tumble", "stacked"];
  if (pathname.includes("flatwork-ironers")) return ["ironer"];
  if (pathname.includes("folders")) return ["folder"];
  if (pathname.includes("feeders")) return ["feeder"];
  if (pathname.includes("dry-cleaning-equipment")) return ["dry-cleaning"];
  if (pathname.includes("finishing-equipments")) return ["press", "finisher"];
  return [];
}

export function getProductsForCategory(pathname: string) {
  const keywords = categoryKeywords(pathname);
  if (!keywords.length) return getProductCollection();
  return getProductCollection().filter((entry) =>
    keywords.some((keyword) => entry.slug.includes(keyword))
  );
}

export function formatDate(date: string) {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

export function getRelatedEntries(entry: SiteEntry) {
  if (entry.kind === "productCategory") {
    return getProductsForCategory(entry.path).slice(0, 8);
  }
  if (entry.kind === "product") {
    const category = getProductCategory(entry);
    return getProductsForCategory(category.href)
      .filter((item) => item.path !== entry.path)
      .slice(0, 8);
  }
  if (entry.path.startsWith("/products/")) {
    return getProductCollection().slice(0, 8);
  }
  if (entry.kind === "post" || entry.kind === "category" || entry.path === "/news/") {
    return getPostCollection().slice(0, 8);
  }
  return getEntries()
    .filter((item) => item.path !== entry.path && item.kind !== "home")
    .slice(0, 6);
}
