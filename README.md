# Eonix Systems Website

Static marketing website for Eonix Systems.

This project is intentionally simple:
- No framework
- No build step
- No package manager
- Plain `HTML`, `CSS`, and `JavaScript`

Open the files, edit them directly, and deploy by pushing to GitHub Pages.

## Project Structure

```text
eonix_systems_website/
|-- index.html
|-- ecosystem.html
|-- product.html
|-- services.html
|-- about.html
|-- contact.html
|-- css/
|   |-- base.css
|   |-- layout.css
|   |-- nav.css
|   |-- footer.css
|   |-- animations.css
|   |-- home.css
|   |-- ecosystem.css
|   |-- product.css
|   |-- services.css
|   |-- about.css
|   `-- contact.css
|-- js/
|   |-- nav.js
|   |-- scroll-reveal.js
|   |-- scroll-animations.js
|   |-- diagram.js
|   `-- stats-counter.js
|-- assets/
|-- _build_scripts/
|-- CNAME
|-- robots.txt
|-- sitemap.xml
`-- README.md
```

## Page Map

- `index.html`: Homepage and top-level brand narrative
- `ecosystem.html`: System architecture and diagram page
- `product.html`: Platform and sensing layer page
- `services.html`: Service offering and stats page
- `about.html`: Brand and engineering manifesto
- `contact.html`: Contact and inquiry page

## CSS Architecture

Shared files load first, page files load last.

Standard order:

```html
css/base.css
css/layout.css
css/nav.css
css/animations.css
css/footer.css
css/home.css
css/[page].css
```

What each file owns:

- `base.css`: tokens, reset, typography, buttons, shared surfaces
- `layout.css`: global page spacing, hero spacing, section rhythm
- `nav.css`: desktop and mobile navbar layout
- `footer.css`: shared footer
- `animations.css`: reveal and motion utilities
- `home.css`: homepage styles plus shared interior section shell styles
- page CSS files: only page-specific layout/components

## Current Design System

The live site now uses a light engineering aesthetic:

- light surfaces instead of the older dark/cyan system
- `Plus Jakarta Sans` for body and headings
- `JetBrains Mono` for system labels and technical eyebrows
- restrained blue accents from CSS variables in `base.css`
- shared section shells and spacing rhythm across interior pages

Important shared patterns:

- `.page-wrapper`: global page frame
- `.page-hero`: shared hero spacing
- `.page-section`: shared horizontal layout width
- `.home-section-shell`: shared interior page panel container
- `.home-tech-divider`: shared divider between major interior sections

Homepage sections still use:

- `.sys-section`
- `.sys-container`
- `.sys-header`
- `.sys-card`

These should stay visually aligned with the shared spacing rules in `layout.css`.

## JavaScript Responsibilities

- `js/nav.js`: mobile menu toggle and desktop active-link slider
- `js/scroll-reveal.js`: reveal-on-scroll behavior
- `js/scroll-animations.js`: additional motion helpers and divider/hero effects
- `js/diagram.js`: architecture canvas rendering used by `ecosystem.html`
- `js/stats-counter.js`: animated number counters used on `services.html`

## Editing Guidelines

- Keep behavior intact unless the task explicitly asks for functionality changes.
- Prefer editing shared CSS before adding one-off page overrides.
- Reuse the existing section shell/header rhythm rather than inventing new spacing systems.
- Avoid hardcoding colors when an existing token in `base.css` fits.
- Keep mobile nav behavior isolated to `nav.css` and `nav.js`.
- If a browser is still showing old CSS or JS, bump the relevant `?v=` query string in the HTML file that loads it.

## Known Maintenance Notes

- The site depends on asset version query strings like `nav.css?v=609` to break browser cache.
- Mobile navbar behavior is split between `nav.css` and `nav.js`; avoid forcing desktop positioning rules into mobile.
- `ecosystem.html` and `product.html` both include inline scripts that coordinate page-specific interactions with shared JS.
- `_build_scripts/` is not runtime code. Treat it as internal helper tooling/documentation only.

## Deployment

The site is deployed as a static GitHub Pages site.

Typical deploy flow:

```bash
git add .
git commit -m "Describe the change"
git push origin main
```

## Context Files

If you change structure or shared conventions, update:

- this `README.md`
- `_build_scripts/README.md` if the role of that folder changes

That keeps the next cleanup pass grounded in the actual codebase instead of outdated assumptions.
