# Home Hero Specification

## Overview
- **Target file:** `src/pages/index.astro`
- **Screenshot:** `docs/design-references/home-desktop.png`
- **Interaction model:** static layout with CTA hover states

## DOM Structure
- Left column with eyebrow, headline, bullet list and CTA buttons.
- Right column with product-category cards.
- Background uses blue gradient with a soft radial highlight.

## Computed Styles

### Container
- dark-to-cyan diagonal gradient
- large vertical padding
- two-column desktop grid

### Headline
- large bold display type
- white text
- tight line height

### Cards
- translucent white panels
- light border
- backdrop blur effect

## States & Behaviors

### CTA hover
- **Trigger:** pointer hover
- **State A:** flat button
- **State B:** brighter background and slight lift

## Responsive Behavior
- **Desktop (1440px):** headline left, cards right
- **Tablet (768px):** reduced spacing
- **Mobile (390px):** stacked layout with cards below CTA

