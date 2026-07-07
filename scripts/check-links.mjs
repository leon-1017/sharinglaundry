import data from "../src/data/site-data.json" with { type: "json" };

const paths = new Set(data.entries.map((entry) => entry.path));
paths.add("/");

const missing = [];
for (const entry of data.entries) {
  for (const match of entry.contentHtml.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (
      href.startsWith("/") &&
      !href.startsWith("/wp-assets/") &&
      !href.startsWith("/#") &&
      !paths.has(href.endsWith("/") ? href : `${href}/`)
    ) {
      missing.push({ from: entry.path, href });
    }
  }
}

if (missing.length) {
  console.error(JSON.stringify(missing.slice(0, 50), null, 2));
  console.error(`Missing internal links: ${missing.length}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${data.entries.length} entries: no missing internal content links.`);
}
