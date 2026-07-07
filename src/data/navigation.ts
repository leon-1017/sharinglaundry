export const productCategories = [
  { label: "WASHER EXTRACTORS", href: "/products/washer-extractors/" },
  { label: "TUMBLE DRYERS", href: "/products/tumble-dryers/" },
  { label: "FLATWORK IRONERS", href: "/products/flatwork-ironers/" },
  { label: "FOLDERS", href: "/products/folders/" },
  { label: "FEEDERS", href: "/products/feeders/" },
  { label: "DRY CLEANING EQUIPMENT", href: "/products/dry-cleaning-equipment/" },
  { label: "FINISHING EQUIPMENTS", href: "/products/finishing-equipments/" },
];

export const mainNavigation = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about-us/" },
  { label: "Products", href: "/products/", children: productCategories },
  { label: "News", href: "/news/" },
  { label: "Support", href: "/support/" },
  { label: "Application", href: "/application/" },
  { label: "Contact us", href: "/contact-us/" },
];
