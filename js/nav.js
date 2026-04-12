/* =============================================================================
   NAV.JS — Navigation Logic & Animations
   ============================================================================= */

document.addEventListener("DOMContentLoaded", () => {
    /* 1. Mobile Hamburger Menu Toggle */
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    const desktopQuery = window.matchMedia("(min-width: 1025px)");

    if (toggle && links) {
        toggle.addEventListener("click", () => {
            links.classList.toggle("open");
        });
    }

    /* 2. Desktop Smooth Sliding Active Indicator */
    const navLinks = document.querySelectorAll('.nav-link');
    const activeLink = document.querySelector('.nav-link.nav-active');

    if (links && navLinks.length > 0) {
        // Create the slider element dynamically
        const slider = document.createElement('div');
        slider.classList.add('nav-slider');
        links.appendChild(slider);

        // Core positioning function
        const updateSlider = (linkEl) => {
            if (!desktopQuery.matches) {
                slider.style.opacity = '0';
                return;
            }

            if (!linkEl) {
                slider.style.opacity = '0';
                return;
            }
            
            // The nav links have a padding of 0 18px.
            // We want the slider to visually match the text width.
            const horizontalPadding = 36; // 18px left + 18px right
            const width = linkEl.offsetWidth - horizontalPadding;
            const leftOffset = linkEl.offsetLeft + (horizontalPadding / 2);
            
            slider.style.width = width + 'px';
            slider.style.transform = `translateX(${leftOffset}px)`;
            slider.style.opacity = '1';
        };

        const syncNavMode = () => {
            if (desktopQuery.matches) {
                links.style.position = 'relative';
                updateSlider(activeLink);
                return;
            }

            links.style.position = '';
            slider.style.opacity = '0';
        };

        // Initialize state without animation
        if (activeLink) {
            slider.style.transition = 'none';
            syncNavMode();
            // Force browser reflow so it snaps to position instantly
            void slider.getBoundingClientRect();
            // Restore smooth transitions for subsequent clicks
            setTimeout(() => {
                slider.style.transition = '';
            }, 50);
        }

        // Hover handling to slide to target
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                if (!desktopQuery.matches) {
                    links.classList.remove("open");
                    return;
                }

                // Let it slide to the clicked tab
                updateSlider(link);
                
                // Only delay navigation if it's a standard internal link
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && href !== window.location.pathname.split('/').pop()) {
                    e.preventDefault();
                    // Wait for the CSS sliding transition (0.3s) before jumping pages
                    setTimeout(() => {
                        window.location.href = href;
                    }, 250);
                }
            });
        });

        // Resize handler to recalculate offset accurately
        window.addEventListener('resize', () => {
            syncNavMode();
        });

        syncNavMode();
    }
});
