# Header Specification

## Overview
- **Target file:** `src/components/Header.astro`
- **Screenshot:** `docs/design-references/home-desktop.png`
- **Interaction model:** hover-driven on desktop, disclosure-driven on mobile

## DOM Structure
- Brand block on the left with compact monogram and company name.
- Center navigation with top-level links.
- Product navigation item expands to a dropdown list of categories.
- Right-side action button on desktop.
- Collapsed `details/summary` menu on mobile.

## Computed Styles

### Container
- sticky top navigation
- white translucent background
- subtle bottom border
- horizontal layout with centered alignment

### Nav Links
- uppercase
- high letter spacing
- dark blue text with cyan hover state

### Dropdown
- white card
- thin border
- soft shadow
- rounded corners

## States & Behaviors

### Desktop dropdown
- **Trigger:** hover on `Products`
- **State A:** dropdown hidden with zero opacity
- **State B:** dropdown visible with translation reset and full opacity
- **Transition:** short ease transition

### Mobile menu
- **Trigger:** summary click
- **State A:** collapsed
- **State B:** stacked blocks with child category links

## Responsive Behavior
- **Desktop (1440px):** full horizontal nav and CTA visible
- **Tablet (768px):** compact layout, dropdown still desktop-first
- **Mobile (390px):** summary/disclosure menu replaces full nav

