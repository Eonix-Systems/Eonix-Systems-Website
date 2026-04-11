/* =============================================================================
   SCROLL-REVEAL.JS — Viewport-Based Fade-In Animations
   =============================================================================
   Uses the IntersectionObserver API to watch all elements with class "reveal".
   When they enter the viewport, the class "is-visible" is added to them.
   The actual visual animation is defined in css/animations.css.

   SUPPORTED CLASSES (add to any HTML element):
   .reveal             → Fades and slides up
   .reveal-left        → Slides in from left (combine: class="reveal reveal-left")
   .reveal-right       → Slides in from right (combine: class="reveal reveal-right")
   .reveal-scale       → Scales up from 96% (combine: class="reveal reveal-scale")

   STAGGER DELAY:
   Add inline style="--delay: 200ms;" for a delay before the animation starts.
   Increment the delay for each consecutive element in a group.

   PERFORMANCE NOTE:
   Once an element becomes visible, it is unobserved (observer.unobserve).
   The animation fires once and never again. This is intentional and efficient.
   ============================================================================= */
document.addEventListener("DOMContentLoaded", () => {
    const reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;

    let observerInitialized = false;

    const initObserver = () => {
        if (observerInitialized) return;
        observerInitialized = true;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Skip elements managed by scroll-animations.js cascade
                        if (entry.target.classList.contains('cascade-managed')) {
                            observer.unobserve(entry.target);
                            return;
                        }
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.08,
                rootMargin: "0px 0px -40px 0px"
            }
        );

        reveals.forEach(el => observer.observe(el));
    };

    // Initialize globally only after scrolling smoothly begins
    window.addEventListener('scroll', () => {
        if (window.scrollY > 15) {
            initObserver();
        }
    }, { passive: true });

    // Fallback if already scrolled down on refresh
    if (window.scrollY > 15) {
        initObserver();
    }
});
