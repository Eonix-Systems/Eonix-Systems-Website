# Eonix Systems Website

Static services-first website for Eonix Systems.

This project is intentionally simple:
- No framework
- No build step
- No package manager
- Plain `HTML`, `CSS`, and `JavaScript`

Open the files, edit them directly, and deploy through Vercel.

## Project Structure

```text
eonix_systems_website/
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
|   |-- product.css     # shared industries layout styles
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
|-- CNAME
|-- robots.txt
|-- sitemap.xml
`-- README.md
```

## Page Map

- `index.html`: Homepage with service positioning, five core service cards, grounded engineering copy, LADS project experience, process, and CTA
- `services.html`: Detailed PCB, firmware, bring-up, power/protection, and manufacturing support sections
- `industries.html`: Industries page for robotics, defence and field electronics, industrial automation, IoT and sensor systems, research labs, and custom embedded products
- `why-eonix.html`: Capability/trust page with short founder note
- `contact.html`: Frontend-only project brief form and direct contact page
- `about.html`, `product.html`, `ecosystem.html`: legacy redirects only; public navigation should not point to them

## Public Positioning

The website is currently an engineering services site. It should present Eonix Systems as an embedded electronics engineering company, not as a public product, platform, or ecosystem.

Current approved positioning:

- PCB design
- Embedded firmware
- Hardware bring-up and debugging
- Power electronics and protection
- Communication interfaces
- Prototype to manufacturing support

Do not publish unreleased internal product, ecosystem, or platform messaging on the public pages. Any defence-related wording must stay careful and should not imply certification, government approval, or official supplier status.

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

The live site uses a light engineering aesthetic:

- light neutral surfaces
- `Plus Jakarta Sans` for body and headings
- `JetBrains Mono` for internal hidden labels and technical utility classes
- restrained blue accent tokens from `base.css`
- shared section shells and spacing rhythm across interior pages
- minimal animation through the existing reveal helpers

Important shared patterns:

- `.page-wrapper`: global page frame
- `.page-hero`: shared hero spacing
- `.page-section`: shared horizontal layout width
- `.home-section-shell`: shared interior page panel container
- `.home-tech-divider`: shared divider between major interior sections
- `.sys-section`, `.sys-container`, `.sys-header`, `.sys-card`: homepage and CTA section system

## JavaScript Responsibilities

- `js/nav.js`: mobile menu toggle and desktop active-link slider
- `js/scroll-reveal.js`: reveal-on-scroll behavior
- `js/scroll-animations.js`: additional motion helpers and divider/hero effects
- `js/diagram.js`: legacy architecture canvas helper; not used by the current public pages
- `js/stats-counter.js`: legacy animated number helper; not used by the current public pages

## Editing Guidelines

- Keep the public navigation as: Home, Services, Industries, Why Eonix, Contact.
- Keep CTAs pointed to `contact.html` unless the CTA is explicitly navigating to service details.
- Keep old route files as lightweight redirects unless the deployment no longer receives traffic for them.
- Reuse the existing section shell/header rhythm before adding a new spacing system.
- Avoid hardcoding colors when an existing token in `base.css` fits.
- Keep mobile nav behavior isolated to `nav.css` and `nav.js`.
- If a browser is still showing old CSS or JS, bump the relevant `?v=` query string in the HTML file that loads it.

## Contact Form Email Setup

The contact page posts to `/api/contact`, which is a Vercel serverless function.
It sends the project brief to Eonix and sends an automated confirmation email to
the visitor.

Required Vercel environment variables:

- `RESEND_API_KEY`: API key from Resend
- `CONTACT_FROM_EMAIL`: verified sender, for example `Eonix Systems <noreply@eonixsystems.com>`
- `CONTACT_TO_EMAIL`: inbox for project briefs, normally `business@eonixsystems.com`

Setup steps:

1. Create a Resend account.
2. Verify `eonixsystems.com` in Resend DNS settings.
3. Create an API key in Resend.
4. Add the variables above in Vercel Project Settings > Environment Variables.
5. Redeploy the site from Vercel after saving the variables.

## Deployment

The site is deployed as a static Vercel site.

Recommended Vercel settings:

- Framework Preset: Other
- Build Command: leave empty
- Output Directory: leave empty or `.`
- Install Command: leave empty
- Production Branch: `main`

The repository includes `vercel.json` for static hosting security headers.

Typical deploy flow:

```bash
git add .
git commit -m "Describe the change"
git push personal main
```

The active local branch tracks `personal/main`. Vercel should redeploy automatically if it is connected to the pushed branch.

## Context Files

If you change structure, shared conventions, or public positioning, update:

- this `README.md`
- `../Eonix-Systems-Context/EONIX_MASTER_CONTEXT.md`

That keeps the next cleanup pass grounded in the actual codebase instead of outdated assumptions.
