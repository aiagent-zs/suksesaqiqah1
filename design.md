---
name: Sukses Aqiqah Command
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4a3d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7b6c'
  outline-variant: '#bdcaba'
  surface-tint: '#006e2d'
  primary: '#006b2c'
  on-primary: '#ffffff'
  primary-container: '#00873a'
  on-primary-container: '#f7fff2'
  inverse-primary: '#62df7d'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#006948'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855d'
  on-tertiary-container: '#f5fff7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#7ffc97'
  primary-fixed-dim: '#62df7d'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is a premium enterprise interface designed for high-stakes operational management. It balances the spiritual significance of Aqiqah and Qurban with the precision of a modern logistics command center. 

The aesthetic is **Modern Minimalist SaaS**, characterized by:
- **Clarity & Focus:** Generous whitespace and a rigid structural hierarchy to prevent cognitive overload during peak operational periods.
- **Trustworthy Professionalism:** A refined palette and systematic layout that conveys reliability and technical excellence.
- **Subtle Elegance:** The integration of gold accents provides a premium "halal-tech" feel without compromising the utility of the dashboard.
- **Soft Precision:** Utilizing high-radius corners (16px) and diffused shadows to create a welcoming, approachable, yet highly organized environment.

## Colors

The palette is anchored in **Primary Green (#16A34A)**, representing growth, vitality, and the core identity of the service. 

- **Primary & Emerald Gradients:** Use the primary green for main actions. For high-level dashboards and premium cards, apply subtle linear gradients from `#16A34A` to `#059669` at a 135-degree angle.
- **Accent Gold:** Reserved for premium status indicators, "Tebarkan Manfaat" highlights, and specialized Qurban tiers.
- **Functional Neutrals:** A range of Slate and Gray scales are used for text and borders to maintain a professional SaaS density.
- **Feedback:** Standard semantic colors for status tracking (Order Pending, Processing, Completed, Cancelled).

## Typography

This design system utilizes **Inter** exclusively to ensure maximum legibility across data-heavy tables and complex operational forms.

- **Weight Strategy:** Use Semi-Bold (600) for section headings and Bold (700) sparingly for primary KPIs. Medium (500) is preferred for UI labels and button text to maintain clarity.
- **Readability:** Line heights are set generously (1.5x for body) to reduce eye strain during long-form data entry.
- **Numerical Data:** For tables and charts, consider `tabular-nums` OpenType features to ensure columns of figures align perfectly.

## Layout & Spacing

The layout follows a **12-column fluid grid** with fixed maximum width for desktop monitors to ensure the command center remains glanceable.

- **Grid System:** 24px gutters provide significant breathing room between data widgets.
- **Sidebar:** A fixed 260px left-hand navigation allows for quick switching between Order Management, Inventory, and Logistics.
- **Content Blocks:** Use an 8px spacing scale for internal component layout and a 16px/24px scale for external margins between cards.
- **Mobile Adaptation:** On mobile, the 12-column grid collapses to a single column, with the sidebar transforming into a bottom navigation bar or a hamburger-triggered overlay.

## Elevation & Depth

Depth is used sparingly to signify interactivity and hierarchy. The system relies on **Ambient Shadows** and **Tonal Layers** rather than heavy borders.

- **Surface Levels:** 
  - Level 0: Background (`#F9FAFB`).
  - Level 1: Primary Cards/Containers (`#FFFFFF`) with a 1px border in `#E2E8F0`.
  - Level 2: Hover states and active dropdowns, using a soft, diffused shadow: `0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)`.
- **Modals:** Use a heavy backdrop blur (8px) and a centralized elevation to focus user attention on critical tasks like "New Order Entry."

## Shapes

The shape language is defined by a consistent **16px radius (1rem)** for all major containers and UI elements.

- **Cards & Modals:** Always use 16px.
- **Buttons & Inputs:** Use 8px (Soft) to create a slight visual distinction between clickable actions and structural containers.
- **Tags/Badges:** Use fully rounded (Pill) shapes for status indicators like "Selesai" or "Proses" to make them instantly recognizable.

## Components

### Buttons
- **Primary:** Primary Green fill, white text. Subtle 2px inner-glow on hover.
- **Gold Accent:** Reserved for "Premium" or "Qurban" specific actions.
- **Ghost/Outline:** Use for secondary actions like "Export" or "Filter," with a 1px Slate-200 border.

### Cards
- **Command Cards:** White background, 16px radius, 1px subtle border. Title should be in `title-md` weight.
- **KPI Stats:** Feature a 4px left-border accent in Primary Green or Gold to categorize the metric.

### Tables & Data Grids
- **Header:** Light gray background (`#F9FAFB`) with uppercase `label-md` text.
- **Rows:** 56px minimum height. Use subtle dividers. Row hover should trigger a faint green tint (`#F0FDF4`).
- **Cells:** Use Lucide icons (20px) for row actions (Edit, View, Delete).

### Forms
- **Inputs:** 1px border with a 4px focus ring in Primary Green (20% opacity). Labels should be `body-md` in Slate-700.
- **Validation:** Error states must use Danger Red for both the border and the helper text.

### Feedback & Navigation
- **Toasts:** Positioned top-right. Success toasts use a green icon; Errors use a red icon.
- **Sidebar:** Active state uses a Primary Green vertical "pill" on the left edge and a light green background tint for the entire menu item.