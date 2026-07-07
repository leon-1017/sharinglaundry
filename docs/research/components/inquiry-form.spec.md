# Inquiry Form Specification

## Overview
- **Target file:** `src/components/InquiryForm.astro`
- **Screenshot:** `docs/design-references/home-desktop.png`
- **Interaction model:** client-side validation

## DOM Structure
- Intro copy
- Name/email row
- Company input
- Message textarea
- Submit action
- Inline success/error messages

## States & Behaviors

### Validation
- **Trigger:** submit
- **State A:** hidden feedback panels
- **State B success:** success panel visible and form reset
- **State B error:** error panel visible with validation message

## Responsive Behavior
- **Desktop (1440px):** name and email side by side
- **Mobile (390px):** fields stack vertically

