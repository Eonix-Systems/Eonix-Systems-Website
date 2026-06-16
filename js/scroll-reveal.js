/* =============================================================================
   SCROLL-REVEAL.JS — Viewport-Based Fade-In Animations
   =============================================================================
   Two-tier reveal system (applies to ALL pages):

   TIER 1 — SECTION CONTAINERS
   Targets: .sys-container (home), .home-section-shell (all other pages),
            .manifesto-container (about).
   The whole container (grey box + all its content) appears at once when the
   section enters the viewport. Children with .reveal are all made visible
   simultaneously — no card-by-card stagger. Grey box never shows before
   its content.

   TIER 2 — INDIVIDUAL REVEALS (.reveal outside a container)
   Standalone .reveal elements (e.g. hero labels, standalone quote sections)
   still animate per-element, supporting .reveal-left / .reveal-right /
   .reveal-scale and optional --delay stagger.

   PERFORMANCE: Each element/container is unobserved after it fires once.
   ============================================================================= */
document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------------------------------------------------
    // TIER 1: Container-level reveal
    // Covers all grey-box containers across every page.
    // .home-section-shell:not(.reveal) — shells that are NOT themselves a
    //   reveal unit (those are handled by TIER 2 as a standalone element).
    // -----------------------------------------------------------------------
    const CONTAINER_SEL = [
        '.sys-container',
        '.home-section-shell:not(.reveal)',
        '.manifesto-container'
    ].join(', ');

    const containers = document.querySelectorAll(CONTAINER_SEL);
    containers.forEach(container => {
        container.querySelectorAll('.reveal').forEach(child => {
            child.classList.add('cascade-managed');
            child.style.removeProperty('--delay');
        });
    });

    // -----------------------------------------------------------------------
    // TIER 2: Individual reveal for elements outside containers
    // -----------------------------------------------------------------------
    const reveals = document.querySelectorAll('.reveal');

    let revealObserverReady = false;
    let containerObserverReady = false;

    function initRevealObserver() {
        if (revealObserverReady) return;
        revealObserverReady = true;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    // Skip anything managed at the container level
                    if (entry.target.classList.contains('cascade-managed')) {
                        observer.unobserve(entry.target);
                        return;
                    }
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            },
            {
                threshold: 0.08,
                rootMargin: '0px 0px -40px 0px'
            }
        );

        reveals.forEach(el => observer.observe(el));
    }

    function initContainerObserver() {
        if (containerObserverReady || !containers.length) return;
        containerObserverReady = true;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;

                    const container = entry.target;
                    // Reveal the container box itself
                    container.classList.add('is-visible');
                    // Reveal all children simultaneously — no stagger
                    container.querySelectorAll('.cascade-managed').forEach(child => {
                        child.classList.add('is-visible');
                    });

                    observer.unobserve(container);
                });
            },
            {
                threshold: 0.05,
                rootMargin: '0px 0px -30px 0px'
            }
        );

        containers.forEach(c => observer.observe(c));
    }

    function initAll() {
        initRevealObserver();
        initContainerObserver();
    }

    initAll();
});
