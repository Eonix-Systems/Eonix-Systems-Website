# Eonix Systems Website

Public website for Eonix Systems.

The site is intentionally simple in implementation:
- Plain `HTML`, `CSS`, and `JavaScript`
- No framework
- No build step
- One Vercel serverless contact handler at `/api/contact`

## Project Structure

```text
Eonix-Systems-Website/
|-- index.html
|-- services.html
|-- industries.html
|-- why-eonix.html
|-- contact.html
|-- about.html          # legacy redirect to why-eonix.html
|-- product.html        # legacy redirect to industries.html
|-- ecosystem.html      # legacy redirect to index.html
|-- css/
|   |-- base.css
|   |-- layout.css
|   |-- nav.css
|   |-- footer.css
|   |-- animations.css
|   |-- home.css
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
|-- api/
|   `-- contact.js
|-- assets/
|-- CNAME
|-- robots.txt
|-- sitemap.xml
`-- README.md
```

## Public Routes

- `index.html`: industrial-style homepage with hero, capability strip, service cards, workflow, industries, case study, and CTA
- `services.html`: six detailed service blocks with scope, deliverables, and best-fit guidance
- `industries.html`: industry-fit page for robotics, industrial automation, IoT, defence, research labs, and embedded products
- `why-eonix.html`: public about-equivalent page with founder note and positioning
- `contact.html`: technical consultation request form backed by `/api/contact`

Legacy routes remain redirects only:

- `about.html -> why-eonix.html`
- `product.html -> industries.html`
- `ecosystem.html -> index.html`

## Public Positioning

The public site must present Eonix Systems as an engineering company, not a public product platform.

Approved public positioning:

- PCB design
- Embedded firmware
- Prototyping and bring-up
- Power electronics and interfaces
- Manufacturing support
- Technical consulting

Avoid:

- product-platform messaging
- ecosystem-first messaging
- startup copy like "revolutionary", "game-changing", or "cutting-edge"
- defence wording that implies certification, official supplier status, or confidential capability disclosure

## Current Design Direction

The current site uses an industrial engineering visual language:

- `#0066FF` primary blue
- `#081B36` dark navy
- white and light steel surfaces
- `Barlow Condensed` for major headings
- `Plus Jakarta Sans` for body copy
- local engineering imagery in `assets/engineering-hero-v1.png`, `assets/engineering-lab-v1.png`, and `assets/manufacturing-bench-v1.png`

Design rules currently in code:

- uppercase high-impact headings for major sections
- no bright gradients, purple palettes, glassmorphism, or startup-style cards
- route-wide consistency through shared `base.css`, `layout.css`, `nav.css`, `footer.css`, and `home.css`

## CSS Ownership

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

Ownership:

- `base.css`: tokens, typography, button styles, base surfaces
- `layout.css`: page width and shared spacing
- `nav.css`: shared navbar and mobile menu
- `footer.css`: shared footer
- `animations.css`: reveal helpers
- `home.css`: shared section system plus homepage sections
- page CSS files: page-specific layout/components only

## JavaScript Responsibilities

- `js/nav.js`: mobile nav toggle and active-link slider
- `js/scroll-reveal.js`: section and element reveal behavior
- `js/scroll-animations.js`: additional motion helpers
- `js/diagram.js`: legacy helper not used by current public pages
- `js/stats-counter.js`: legacy helper not used by current public pages

## Contact Form

`contact.html` posts multipart form data to `/api/contact`.

`api/contact.js`:

- validates required fields
- filters honeypot spam
- sends the project brief to Eonix through Resend
- forwards optional uploaded project files as attachments on the internal Eonix email
- sends an auto-confirmation email to the visitor

Upload limits:

- maximum 5 files
- maximum 4 MB total upload size, to stay under Vercel serverless request limits

Required Vercel environment variables:

- `RESEND_API_KEY`
- `CONTACT_FROM_EMAIL`
- `CONTACT_TO_EMAIL`

## Deployment

The website is deployed on Vercel with plain static pages plus the contact serverless function.

Recommended settings:

- Framework Preset: Other
- Build Command: empty
- Output Directory: empty or `.`
- Install Command: empty
- Production Branch: `main`

## Editing Rules

- Keep the public navigation as `Home`, `Services`, `Industries`, `Why Eonix`, `Contact`.
- Keep legacy route files as redirects unless the public routing strategy changes.
- Reuse the shared section shell system before creating new layout conventions.
- Keep CTA targets on `contact.html` unless the CTA is intentionally pointing to deeper page content.
- If CSS or JS changes are not visible in browser cache, bump the relevant `?v=` query string in the loading HTML.

## Context Files

If you change public structure, shared visual conventions, or website behavior, update:

- this `README.md`
- `../Eonix-Systems-Context/EONIX_MASTER_CONTEXT.md`
