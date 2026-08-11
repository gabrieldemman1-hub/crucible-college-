/**
 * Crucible College — progress tracking + UI behaviors (the ONLY script).
 *
 * Loaded by every page via base.njk. Concerns:
 *   1. Completion:  localStorage["crucible-college:complete:v1"] = {"<slug>": true, ...}
 *   2. Resume:      localStorage["crucible-college:resume:v1"]   = "<slug>"
 *   3. UI behaviors: nav dropdown, command palette (Ctrl/⌘+K), progress ring,
 *      lesson read-progress bar, scroll-reveal, completion toast + seal stamp.
 *
 * Every storage access is wrapped in try/catch: if storage is unavailable
 * (private mode, blocked, quota), the site stays fully usable — completion
 * simply doesn't persist and the resume card shows its first-time state.
 * Motion features check prefers-reduced-motion and no-op when reduced.
 */
(function () {
  "use strict";

  var COMPLETE_KEY = "crucible-college:complete:v1";
  var RESUME_KEY = "crucible-college:resume:v1";
  var THEME_KEY = "crucible-college:theme:v1";

  var reducedMotion = false;
  try {
    reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* treat as motion-ok */ }

  // ── Storage layer (all access guarded) ──────────────────────────────────

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function getCompleteMap() {
    var raw = storageGet(COMPLETE_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function setComplete(slug, done) {
    var map = getCompleteMap();
    if (done) { map[slug] = true; } else { delete map[slug]; }
    storageSet(COMPLETE_KEY, JSON.stringify(map));
    return map;
  }

  function isComplete(map, slug) {
    return map[slug] === true;
  }

  function completeCount(map) {
    var n = 0;
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && map[key] === true) n++;
    }
    return n;
  }

  function getResumeSlug() {
    return storageGet(RESUME_KEY);
  }

  function setResumeSlug(slug) {
    storageSet(RESUME_KEY, slug);
  }

  function getLessonIndex() {
    var el = document.querySelector("[data-lesson-index]");
    if (!el) return [];
    try {
      var parsed = JSON.parse(el.textContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  // ── Rendering (reads the DOM each page ships, updates in place) ────────

  var RING_CIRCUMFERENCE = 2 * Math.PI * 9;

  function renderProgressIndicators(map) {
    var count = completeCount(map);

    var counters = document.querySelectorAll("[data-progress-count]");
    for (var i = 0; i < counters.length; i++) {
      counters[i].textContent = String(count);
    }

    var totalEl = document.querySelector("[data-progress-total]");
    var total = totalEl ? parseInt(totalEl.getAttribute("data-progress-total"), 10) : 0;

    var bar = document.querySelector("[data-progress-bar]");
    var fill = document.querySelector("[data-progress-fill]");
    if (bar) bar.setAttribute("aria-valuenow", String(count));
    if (fill && total > 0) fill.style.width = (100 * count / total) + "%";

    var ring = document.querySelector("[data-progress-ring]");
    if (ring && total > 0) {
      ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - count / total));
      ring.classList.toggle("is-full", count >= total);
    }
  }

  function renderCompletionMarks(map) {
    // Curriculum cards, chapter sidebar items, and nav dropdown items all
    // declare their lesson slug; toggle .is-complete on each.
    var marked = document.querySelectorAll("[data-lesson-card], [data-sidebar-lesson], [data-lesson-link]");
    for (var i = 0; i < marked.length; i++) {
      var el = marked[i];
      var slug = el.getAttribute("data-lesson-card") ||
                 el.getAttribute("data-sidebar-lesson") ||
                 el.getAttribute("data-lesson-link");
      el.classList.toggle("is-complete", isComplete(map, slug));
    }
  }

  function renderChapterChips(map) {
    var chips = document.querySelectorAll("[data-chapter-progress]");
    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var section = chip.closest(".chapter");
      if (!section) continue;
      var cards = section.querySelectorAll("[data-lesson-card]");
      var done = 0;
      for (var j = 0; j < cards.length; j++) {
        if (isComplete(map, cards[j].getAttribute("data-lesson-card"))) done++;
      }
      chip.textContent = done + "/" + cards.length;
      chip.classList.toggle("is-done", cards.length > 0 && done === cards.length);
    }
  }

  function renderToggle(map, slug) {
    var toggle = document.querySelector("[data-complete-toggle]");
    if (!toggle) return;
    var done = isComplete(map, slug);
    toggle.setAttribute("aria-pressed", done ? "true" : "false");
    var label = toggle.querySelector("[data-complete-label]");
    if (label) label.textContent = done ? "Completed" : "Mark as complete";
    var seal = document.querySelector("[data-lesson-seal]");
    if (seal) seal.classList.toggle("is-complete", done);
  }

  function renderResumeCard() {
    var card = document.querySelector("[data-resume]");
    if (!card) return;

    var slug = getResumeSlug();
    if (!slug) return; // first visit — keep the server-rendered "start here" state

    var lessons = getLessonIndex();
    var match = null;
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].slug === slug) { match = lessons[i]; break; }
    }
    if (!match) return; // stale slug (lesson removed) — fall back to default state

    card.setAttribute("href", match.url);
    var kicker = card.querySelector("[data-resume-kicker]");
    var title = card.querySelector("[data-resume-title]");
    var tag = card.querySelector("[data-resume-tag]");
    if (kicker) kicker.textContent = "Continue where you left off";
    if (title) title.textContent = "Lesson " + match.tag + " — " + match.title;
    if (tag) tag.textContent = match.tag;
  }

  function renderAll(map) {
    renderCompletionMarks(map);
    renderChapterChips(map);
    renderProgressIndicators(map);
  }

  // ── Toast + seal stamp ─────────────────────────────────────────────────

  var toastTimer = null;

  function showToast(message) {
    var toast = document.querySelector("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2400);
  }

  function stampSeal() {
    if (reducedMotion) return;
    var seal = document.querySelector("[data-lesson-seal]");
    if (!seal) return;
    seal.classList.remove("stamp");
    void seal.offsetWidth; // restart the animation
    seal.classList.add("stamp");
  }

  // ── Theme toggle (initial theme is set pre-paint by an inline script) ──

  function initThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    function syncLabel() {
      var theme = document.documentElement.getAttribute("data-theme");
      btn.setAttribute("aria-label",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    }

    btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      storageSet(THEME_KEY, next);
      syncLabel();
    });
    syncLabel();
  }

  // ── Nav dropdown (hover via CSS; click/keyboard here) ──────────────────

  function initDropdown() {
    var dropdown = document.querySelector("[data-dropdown]");
    if (!dropdown) return;
    var toggle = dropdown.querySelector("[data-dropdown-toggle]");

    function setOpen(open) {
      dropdown.classList.toggle("is-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    if (toggle) {
      toggle.addEventListener("click", function () {
        setOpen(!dropdown.classList.contains("is-open"));
      });
    }
    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target)) setOpen(false);
    });
    dropdown.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && dropdown.classList.contains("is-open")) {
        setOpen(false);
        if (toggle) toggle.focus();
      }
    });
    dropdown.addEventListener("focusout", function (e) {
      // Only close when focus verifiably moved elsewhere on the page —
      // a null relatedTarget (window blur, etc.) should not slam the menu shut.
      if (e.relatedTarget && !dropdown.contains(e.relatedTarget)) setOpen(false);
    });
  }

  // ── Command palette (Ctrl/⌘ + K) ───────────────────────────────────────

  function initPalette() {
    var dialog = document.querySelector("[data-palette]");
    var openBtn = document.querySelector("[data-palette-open]");
    if (!dialog || typeof dialog.showModal !== "function") {
      if (openBtn) openBtn.hidden = true;
      return;
    }

    var input = dialog.querySelector("[data-palette-input]");
    var list = dialog.querySelector("[data-palette-results]");

    var items = [
      { tag: "•", title: "Home", url: "/" },
      { tag: "•", title: "Curriculum", url: "/curriculum/" },
      { tag: "•", title: "Meta Builds", url: "/builds/" },
      { tag: "•", title: "Dictionary", url: "/dictionary/" },
      { tag: "•", title: "Resources — external links", url: "/resources/" }
    ];
    var lessons = getLessonIndex();
    for (var i = 0; i < lessons.length; i++) items.push(lessons[i]);

    var filtered = items.slice();
    var activeIndex = 0;

    function render() {
      var map = getCompleteMap();
      list.textContent = "";
      if (!filtered.length) {
        var empty = document.createElement("p");
        empty.className = "palette__empty";
        empty.textContent = "No matches — try a lesson tag like “2A”.";
        list.appendChild(empty);
        return;
      }
      for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        var li = document.createElement("li");
        li.className = "palette__item" + (i === activeIndex ? " is-active" : "");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
        li.setAttribute("data-url", item.url);
        li.setAttribute("data-idx", String(i));

        var tag = document.createElement("span");
        tag.className = "palette__item-tag";
        tag.textContent = item.tag;
        li.appendChild(tag);

        var title = document.createElement("span");
        title.textContent = item.title;
        li.appendChild(title);

        if (item.slug && isComplete(map, item.slug)) {
          var done = document.createElement("span");
          done.className = "palette__item-done";
          done.textContent = "✓";
          li.appendChild(done);
        }
        list.appendChild(li);
      }
    }

    function applyFilter(query) {
      var q = query.trim().toLowerCase();
      filtered = !q ? items.slice() : items.filter(function (item) {
        return (item.tag + " " + item.title).toLowerCase().indexOf(q) !== -1;
      });
      activeIndex = 0;
      render();
    }

    function open() {
      dialog.showModal();
      input.value = "";
      applyFilter("");
      input.focus();
    }

    function go() {
      var item = filtered[activeIndex];
      if (item) window.location.assign(item.url);
    }

    if (openBtn) openBtn.addEventListener("click", open);

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (dialog.open) { dialog.close(); } else { open(); }
      }
    });

    input.addEventListener("input", function () { applyFilter(input.value); });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
      } else if (e.key === "Enter") {
        e.preventDefault();
        go();
      }
    });

    list.addEventListener("click", function (e) {
      var li = e.target.closest("[data-url]");
      if (li) window.location.assign(li.getAttribute("data-url"));
    });
    list.addEventListener("mousemove", function (e) {
      var li = e.target.closest("[data-idx]");
      if (!li) return;
      var idx = parseInt(li.getAttribute("data-idx"), 10);
      if (idx !== activeIndex) { activeIndex = idx; render(); }
    });

    // Click on the backdrop (the dialog element itself) closes.
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  }

  // ── Lesson read-progress bar ───────────────────────────────────────────

  function initReadProgress() {
    var fill = document.querySelector("[data-read-progress]");
    if (!fill) return;
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.transform = "scaleX(" + frac + ")";
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  // ── Scroll-reveal (skipped entirely under reduced motion / no IO) ──────

  function initReveal() {
    if (reducedMotion || !("IntersectionObserver" in window)) return;
    var selector = ".home-panel, .resume-card, .lesson-card, .build-card, .glossary__entry, " +
                   ".objectives, .video-slot, .lesson-body section, .takeaways, .pager, " +
                   ".weapon-card, .build-body section, .external-links li";
    var els = document.querySelectorAll(selector);
    if (!els.length) return;

    document.documentElement.classList.add("js-reveal");
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("is-visible");
          observer.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -4% 0px" });

    for (var i = 0; i < els.length; i++) {
      els[i].classList.add("reveal");
      els[i].style.transitionDelay = (i % 4) * 55 + "ms";
      observer.observe(els[i]);
    }
  }

  // ── Page wiring ────────────────────────────────────────────────────────

  function init() {
    var map = getCompleteMap();
    var lessonSlug = document.body.getAttribute("data-lesson-slug");

    if (lessonSlug) {
      setResumeSlug(lessonSlug); // "most recently viewed" = this page
      renderToggle(map, lessonSlug);

      var toggle = document.querySelector("[data-complete-toggle]");
      if (toggle) {
        toggle.addEventListener("click", function () {
          var current = getCompleteMap();
          var nowDone = !isComplete(current, lessonSlug);
          var next = setComplete(lessonSlug, nowDone);
          renderToggle(next, lessonSlug);
          renderAll(next);
          if (nowDone) {
            stampSeal();
            showToast("Lesson sealed — progress saved");
          } else {
            showToast("Marked as not complete");
          }
        });
      }
    }

    renderAll(map);
    renderResumeCard();
    initThemeToggle();
    initDropdown();
    initPalette();
    initReadProgress();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
