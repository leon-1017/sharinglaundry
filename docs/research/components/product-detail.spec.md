# Product Detail Specification

## Overview
- **Target file:** `src/pages/[...slug].astro`
- **Screenshot:** `docs/research/product-detail-snapshot.md`
- **Interaction model:** mostly static with tabbed information in the original WordPress page

## DOM Structure
- Breadcrumb above the product content.
- Main content split between image/details and specification text.
- Product title and category marker.
- Tab set in the original page for `Description` and `Technical Parameters`.
- Related products below the description.

## States & Behaviors

### Tabbed content in source site
- **Trigger:** click on `Description` / `Technical Parameters`
- **State A:** description text visible
- **State B:** technical parameter table visible
- **Implementation note:** current static rebuild keeps a single content column and related entries block instead of recreating WooCommerce tabs one-to-one.

## Text Content
- The captured example product page is `Laundry Washing Machine`.
- Source snapshot confirms a long-form description list and a related-products section.

## Responsive Behavior
- **Desktop (1440px):** two-column product intro with media and details
- **Mobile (390px):** product content stacks vertically

