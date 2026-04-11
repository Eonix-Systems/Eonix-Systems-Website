/* =============================================================================
   SCROLL-ANIMATIONS.JS — Advanced Scroll-Driven Motion System
   =============================================================================
   Anime.js-inspired scroll animations for the Eonix homepage.
   Vanilla JS, zero dependencies. Uses IntersectionObserver + requestAnimationFrame.

   Features:
   1. Staggered word/line reveals (hero text)
   2. Scroll-linked parallax layers
   3. Divider line draw-in from center
   4. Card stagger cascade
   5. Counter tick-up
   6. Magnetic button hover
   7. Smooth scroll progress tracking
   ============================================================================= */

(function () {
  'use strict';

  // -- Utility: clamp --
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // -- Utility: lerp --
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // -- Utility: map range --
  function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  // =============================================
  // 1. STAGGERED WORD REVEAL (Hero Title)
  // =============================================
  function initWordReveal() {
    const titles = document.querySelectorAll('.home-title');
    titles.forEach(function (title) {
      // Wrap each word in a span, preserve <br> and child elements
      const children = Array.from(title.childNodes);
      title.innerHTML = '';

      let wordIndex = 0;
      children.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          var words = node.textContent.split(/(\s+)/);
          words.forEach(function (word) {
            if (word.trim() === '') {
              title.appendChild(document.createTextNode(word));
              return;
            }
            var span = document.createElement('span');
            span.className = 'word-reveal';
            span.style.setProperty('--word-i', wordIndex);
            span.textContent = word;
            title.appendChild(span);
            wordIndex++;
          });
        } else if (node.nodeName === 'BR') {
          title.appendChild(node.cloneNode());
        } else {
          // Handle <span class="text-accent"> etc.
          var wrapper = node.cloneNode(false);
          var innerWords = node.textContent.split(/(\s+)/);
          innerWords.forEach(function (word) {
            if (word.trim() === '') {
              wrapper.appendChild(document.createTextNode(word));
              return;
            }
            var span = document.createElement('span');
            span.className = 'word-reveal';
            span.style.setProperty('--word-i', wordIndex);
            span.textContent = word;
            wrapper.appendChild(span);
            wordIndex++;
          });
          title.appendChild(wrapper);
        }
      });
    });

    // Mark title as ready (removes visibility:hidden FOUC guard)
    titles.forEach(function (t) { t.classList.add('words-ready'); });

    // Trigger after a short delay so the page settles
    requestAnimationFrame(function () {
      setTimeout(function () {
        document.querySelectorAll('.word-reveal').forEach(function (el) {
          el.classList.add('is-visible');
        });
      }, 200);
    });
  }

  // =============================================
  // 2. SUBTITLE FADE-UP (delayed after words)
  // =============================================
  function initSubtitleReveal() {
    var subtitle = document.querySelector('.subtitle-animate');
    if (!subtitle) return;
    setTimeout(function () {
      subtitle.classList.add('is-visible');
    }, 900);
  }

  // =============================================
  // 3. HERO BUTTONS STAGGER
  // =============================================
  function initHeroButtons() {
    var actions = document.querySelector('.hero-actions-animate');
    if (!actions) return;
    setTimeout(function () {
      actions.classList.add('is-visible');
    }, 1100);
  }

  // =============================================
  // 4. SYS LABEL TYPING EFFECT
  // =============================================
  function initSysLabelType() {
    var label = document.querySelector('.hero-sys-label');
    if (!label) return;
    var text = label.textContent;
    label.textContent = '';
    label.classList.add('sys-label-typing');
    var i = 0;
    function typeChar() {
      if (i < text.length) {
        label.textContent += text[i];
        i++;
        setTimeout(typeChar, 25 + Math.random() * 15);
      } else {
        label.classList.add('typed-done');
      }
    }
    setTimeout(typeChar, 100);
  }

  // =============================================
  // 5. DIVIDER LINE DRAW-IN
  // =============================================
  let dividersObserverInitialized = false;
  function initDividerDrawIn() {
    var dividers = document.querySelectorAll('.home-tech-divider');
    dividers.forEach(function (divider) {
      divider.classList.add('divider-draw');
    });

    const initDivObserver = () => {
        if (dividersObserverInitialized) return;
        dividersObserverInitialized = true;
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('drawn');
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.5 });
        dividers.forEach(function (d) { observer.observe(d); });
    };

    window.addEventListener('scroll', () => { if (window.scrollY > 15) initDivObserver(); }, { passive: true });
    if (window.scrollY > 15) initDivObserver();
  }

  // =============================================
  // 6. CARD STAGGER CASCADE
  // =============================================
  let cascadeObserverInitialized = false;
  function initCardCascade() {
    // Override the default scroll-reveal for cards inside these groups.
    var groups = [
      { sel: '.provides-grid', children: '.provides-card' },
      { sel: '.deployment-grid', children: '.home-diff-item' },
      { sel: '.gap-vs-container', children: '.gap-card, .gap-vs-text' },
      { sel: '.who-list', children: '.who-list-item' }
    ];

    groups.forEach(function (g) {
      var parent = document.querySelector(g.sel);
      if (!parent) return;
      var cards = parent.querySelectorAll(g.children);
      cards.forEach(function (card) {
        card.classList.add('cascade-managed');
        card.style.removeProperty('--delay');
      });
    });

    const initCascObserver = () => {
        if (cascadeObserverInitialized) return;
        cascadeObserverInitialized = true;
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var group = groups.find(function (g) { return entry.target.matches(g.sel); });
              if (!group) return;
              var cards = entry.target.querySelectorAll(group.children);
              cards.forEach(function (card, idx) {
                setTimeout(function () {
                  card.classList.add('is-visible');
                }, idx * 120);
              });
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        groups.forEach(function (g) {
          var el = document.querySelector(g.sel);
          if (el) observer.observe(el);
        });
    };

    window.addEventListener('scroll', () => { if (window.scrollY > 15) initCascObserver(); }, { passive: true });
    if (window.scrollY > 15) initCascObserver();
  }

  // =============================================
  // 7. SCROLL-LINKED PARALLAX
  // =============================================
  var parallaxElements = [];

  function initParallax() {
    // Assign parallax to specific sections
    var hero = document.querySelector('.home-hero-inner');
    if (hero) parallaxElements.push({ el: hero, speed: 0.15, type: 'y' });

    var matters = document.querySelector('.home-matters');
    if (matters) parallaxElements.push({ el: matters, speed: 0.08, type: 'y' });

    var gapCenter = document.querySelector('.gap-center');
    if (gapCenter) parallaxElements.push({ el: gapCenter, speed: 0.05, type: 'y' });

    if (parallaxElements.length > 0) {
      window.addEventListener('scroll', onParallaxScroll, { passive: true });
    }
  }

  function onParallaxScroll() {
    var scrollY = window.scrollY;
    var viewH = window.innerHeight;

    parallaxElements.forEach(function (item) {
      var rect = item.el.getBoundingClientRect();
      var elCenter = rect.top + rect.height / 2;
      var offset = (elCenter - viewH / 2) * item.speed;
      item.el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
    });
  }

  // =============================================
  // 8. MAGNETIC BUTTON HOVER
  // =============================================
  function initMagneticButtons() {
    var buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    buttons.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.15).toFixed(1) + 'px, ' + (y * 0.15).toFixed(1) + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = 'translate(0, 0)';
        btn.style.transition = 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
        setTimeout(function () {
          btn.style.transition = '';
        }, 350);
      });
    });
  }

  // =============================================
  // 9. SCROLL PROGRESS BAR (top of page)
  // =============================================
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    document.body.appendChild(bar);

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = progress + '%';
    }, { passive: true });
  }

  // =============================================
  // 10. SECTION NUMBER COUNTER (for who-index)
  // =============================================
  function initIndexCounter() {
    var indices = document.querySelectorAll('.who-index');
    if (!indices.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          var finalText = target.textContent; // e.g. "[01]"
          var match = finalText.match(/\d+/);
          if (!match) return;
          var finalNum = parseInt(match[0], 10);
          var current = 0;

          function tick() {
            current++;
            target.textContent = '[' + String(current).padStart(2, '0') + ']';
            if (current < finalNum) {
              setTimeout(tick, 60);
            }
          }
          target.textContent = '[00]';
          setTimeout(tick, 200);
          observer.unobserve(target);
        }
      });
    }, { threshold: 0.5 });

    indices.forEach(function (idx) { observer.observe(idx); });
  }

  // =============================================
  // 11. SMOOTH SECTION ENTRANCE TRACKING
  // =============================================
  function initSectionTracker() {
    var sections = document.querySelectorAll('.page-section');
    sections.forEach(function (section, i) {
      section.style.setProperty('--section-i', i);
    });
  }

  // =============================================
  // INIT
  // =============================================

  // Respect reduced motion — bail out entirely
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Run on ALL pages
    initScrollProgress();
    initMagneticButtons();
    initDividerDrawIn();
    initSysLabelType();
    initSectionTracker();

    // Wait, the rest of these animations should run globally on any page that uses the classes
    // Removed the home-root early return.

    initWordReveal();
    initSubtitleReveal();
    initHeroButtons();
    initCardCascade();
    initParallax();
    initIndexCounter();
  });

})();
