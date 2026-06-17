---
name: Traveler's Atelier
colors:
  surface: '#fdf9f1'
  surface-dim: '#dddad2'
  surface-bright: '#fdf9f1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3eb'
  surface-container: '#f1ede6'
  surface-container-high: '#ece8e0'
  surface-container-highest: '#e6e2da'
  on-surface: '#1c1c17'
  on-surface-variant: '#4d463a'
  inverse-surface: '#31302b'
  inverse-on-surface: '#f4f0e8'
  outline: '#7f7668'
  outline-variant: '#d0c5b5'
  surface-tint: '#745a27'
  primary: '#745a27'
  on-primary: '#ffffff'
  primary-container: '#c9a96e'
  on-primary-container: '#543d0c'
  inverse-primary: '#e4c285'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdf'
  on-secondary-container: '#636262'
  tertiary: '#4e5e82'
  on-tertiary: '#ffffff'
  tertiary-container: '#9dadd5'
  on-tertiary-container: '#314163'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdea4'
  primary-fixed-dim: '#e4c285'
  on-primary-fixed: '#261900'
  on-primary-fixed-variant: '#5a4312'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#b6c6ef'
  on-tertiary-fixed: '#081b3b'
  on-tertiary-fixed-variant: '#374669'
  background: '#fdf9f1'
  on-background: '#1c1c17'
  surface-variant: '#e6e2da'
  surface-rice: '#F8F4EC'
  card-paper: '#FFFDF8'
  text-main: '#2C2C2C'
  text-muted: '#5A5A5A'
  accent-gold: '#C9A96E'
  divider-sand: '#E5DED1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 40px
  section-gap: 64px
---

## Brand & Style

The design system is built on the concept of a "Traveler’s Atelier," moving away from cold, algorithmic AI outputs toward a warm, curated, and deeply personal travel journal experience. It evokes the feeling of receiving a handwritten letter from a knowledgeable local friend. The target audience is the discerning traveler who values storytelling, aesthetics, and meaningful experiences over checklist-style sightseeing.

The design style is **Editorial Minimalism**. It draws heavily from premium lifestyle publications and digital journals like Apple Journal and Airbnb. Key characteristics include:
- **Warmth:** Using organic, tactile color tones that mimic high-quality paper and natural light.
- **Clarity:** Heavy use of whitespace and a structured typographic scale to ensure information is digestible but never "data-heavy."
- **Storytelling:** UI elements are treated as components of a physical scrapbook—cards look like polaroids or notes, and layouts follow a narrative flow rather than a rigid dashboard structure.
- **Sophistication:** Subtle use of borders and soft shadows to create depth without relying on artificial gradients or tech-centric flourishes.

## Colors

The palette is intentionally limited and low-saturation to maintain a "journal" feel. 
- **Primary (Warm Gold):** Reserved for moments of delight, high-priority highlights (e.g., "Why we recommend this"), and active states. It should be used sparingly to maintain its impact.
- **Surface (Rice White):** The foundation of the entire system. This warm neutral replaces pure white to reduce eye strain and provide a tactile, organic background.
- **Card (Paper Texture):** A slightly brighter off-white used for interactive elements and content containers to create a subtle "layered paper" effect.
- **Typography:** Two levels of gray-black are used to maintain high contrast for readability while avoiding the harshness of pure black.

## Typography

This system uses **Inter** exclusively to achieve a modern, clean, and highly legible editorial look. The distinction between roles is managed through weight and size rather than font switching.

- **Headlines:** Use tighter letter spacing and semi-bold/bold weights to create a strong visual anchor for each "journal entry."
- **Body:** Generous line-height (1.5x - 1.6x) is used to ensure a comfortable reading experience, mimicking the layout of a physical book or magazine.
- **Labels:** Small caps or increased letter spacing should be used for metadata (e.g., "DAY 1") to create a clear hierarchy between administrative info and narrative content.
- **High Contrast:** Use `#2C2C2C` for all major headings and `#5A5A5A` for body text to maintain clear visual separation.

## Layout & Spacing

The layout follows a **Fluid Content Grid** approach. On desktop, content is centered within a maximum width of 1200px. On mobile, we prioritize a single-column narrative flow with generous side margins to prevent a cramped "app" feeling.

- **Rhythm:** An 8px base unit drives all spacing. 
- **Section Gaps:** Use large vertical spacing (`section-gap`) between days or major modules to signify a change in the travel narrative.
- **Narrative Blocks:** Transition modules (the "gray-background" blocks) should stretch full-bleed on mobile to break the visual rhythm of the cards, signaling a pause in the itinerary.
- **Responsive Behavior:** 
    - **Desktop:** 12-column grid for the homepage; centered narrow column (800px) for the itinerary detail to mimic a page.
    - **Mobile:** 4-column grid with simplified gutters.

## Elevation & Depth

To avoid the "tech" look, the system eschews traditional high-drop shadows. Instead, it uses **Tonal Layering** and **Soft Ambient Depth**.

- **Surface Levels:** 
    - Level 0: `#F8F4EC` (Background).
    - Level 1: `#FFFDF8` (Cards/Main Content).
- **Shadows:** Use extremely soft, tinted shadows (`rgba(44, 44, 44, 0.04)`) with a large blur radius (20px+) and zero spread. This makes cards look like they are resting lightly on paper rather than floating in digital space.
- **Transitions:** Between major sections, use the "Narrative Bridge" style—a subtle `#F2EDE4` background color change to differentiate between the "Travel Letter" and the "Itinerary Details."

## Shapes

The shape language is defined by **large, pill-like softness**. This removes the clinical sharpness of digital tools and reinforces the "friendly travel companion" persona.

- **Default (8px):** Minor UI elements like tags or small buttons.
- **Large (16px):** Standard content cards and search bars.
- **Extra Large (24px):** Hero sections, travel letters, and primary containers.
- **Pill:** Used for "Continue" buttons and status indicators to maintain a soft, approachable silhouette.

## Components

- **Buttons:** 
    - *Primary:* Filled with `#C9A96E`, white text, 24px corner radius.
    - *Secondary:* Ghost style with `#2C2C2C` border and text.
- **Cards (The "Scrapbook" Card):** 
    - Background: `#FFFDF8`.
    - Corner Radius: 20px.
    - Image: 16:9 or 4:3 aspect ratio with 12px internal padding to look like a framed photo.
- **The "Travel Letter":** 
    - A special full-width card with a subtle border (`1px solid #E5DED1`) and a specific italicized signature block at the bottom right.
- **Input Fields:**
    - Large 64px height for the main search.
    - Background: `#FFFDF8`.
    - Focus State: Subtle border in `#C9A96E`, no heavy outer glows.
- **Chips/Tags:** 
    - Rounded-full (Pill).
    - Background: Transparent with a 1px border of `#E5DED1` or a light gold tint for "Recommended" reasons.
- **Dividers:** 
    - Use `#E5DED1`. When separating days, use a "dotted" or "line with icon" style to evoke a travel map path.