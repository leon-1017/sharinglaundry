export type EntryKind =
  | "home"
  | "page"
  | "post"
  | "product"
  | "category"
  | "productCategory"
  | "shop";

export interface SiteAsset {
  sourceUrl: string;
  localPath: string;
  kind: "image" | "icon" | "video" | "other";
  bytes?: number;
  ok: boolean;
  error?: string;
}

export interface SiteEntry {
  id: string;
  kind: EntryKind;
  sourceUrl: string;
  path: string;
  slug: string;
  title: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  images: string[];
  excerpt: string;
  contentHtml: string;
  plainText: string;
  techTableHtml?: string;
  listingProducts?: Array<{ title: string; href: string; image: string }>;
  imageBoxCards?: Array<{ title: string; href: string; image: string }>;
  fallbackContent?: string;
  sitemapSource: string;
}

export interface SiteData {
  generatedAt: string;
  source: string;
  counts: Record<string, number>;
  entries: SiteEntry[];
  assets: SiteAsset[];
  failed: Array<{ url: string; error: string }>;
}
