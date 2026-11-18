/**
 * Crucible College — progress tracking + UI behaviors (the only external
 * script; base.njk also carries a small inline script that sets the theme
 * before first paint).
 *
 * Loaded by every page via base.njk. Concerns:
 *   1. Completion:  localStorage["crucible-college:complete:v1"] = {"<slug>": true, ...}
 *   2. Resume:      localStorage["crucible-college:resume:v1"]   = "<slug>"
 *   3. UI behaviors: theme toggle, nav dropdown, command palette (Ctrl/⌘+K),
 *      progress ring, lesson read-progress bar, scroll-reveal, completion
 *      toast + seal stamp.
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

  // ── Header height → CSS (anchor offset + sticky sidebar offset) ─────────
  // Runs at once, before the browser scrolls to a #fragment. The value is 0
  // where the header is not sticky (phones).
  function syncHeaderHeight() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var sticky = window.getComputedStyle(header).position === "sticky";
    document.documentElement.style.setProperty("--header-h", (sticky ? header.offsetHeight : 0) + "px");
  }
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  window.addEventListener("load", syncHeaderHeight);
  // The header can also change height without a resize (for example a late
  // web font swap re-wrapping the nav).
  if (window.ResizeObserver) {
    var headerEl = document.querySelector(".site-header");
    if (headerEl) new ResizeObserver(syncHeaderHeight).observe(headerEl);
  }

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
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
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
    var lessons = getLessonIndex();
    var n = 0;
    for (var i = 0; i < lessons.length; i++) {
      if (isComplete(map, lessons[i].slug)) n++;
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
      var done = isComplete(map, slug);
      el.classList.toggle("is-complete", done);
      // The tick is decorative; sidebar and dropdown items also get the state
      // as hidden text (curriculum cards already show a "Completed" pill).
      if (!el.hasAttribute("data-lesson-card")) {
        var note = el.querySelector("[data-complete-note]");
        if (done && !note) {
          note = document.createElement("span");
          note.className = "visually-hidden";
          note.setAttribute("data-complete-note", "");
          note.textContent = " (completed)";
          el.appendChild(note);
        } else if (!done && note) {
          note.parentNode.removeChild(note);
        }
      }
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

  var resumeDefault = null; // the server-rendered "start here" state of the Home card

  function renderResumeCard() {
    var card = document.querySelector("[data-resume]");
    if (!card) return;
    var kicker = card.querySelector("[data-resume-kicker]");
    var title = card.querySelector("[data-resume-title]");
    var tag = card.querySelector("[data-resume-tag]");
    if (!resumeDefault) {
      // First call is from init(), on the untouched markup.
      resumeDefault = {
        href: card.getAttribute("href"),
        kicker: kicker ? kicker.textContent : "",
        title: title ? title.textContent : "",
        tag: tag ? tag.textContent : ""
      };
    }

    var slug = getResumeSlug();
    var match = null;
    if (slug) {
      var lessons = getLessonIndex();
      for (var i = 0; i < lessons.length; i++) {
        if (lessons[i].slug === slug) { match = lessons[i]; break; }
      }
    }
    // No history, or a stale slug (lesson removed, storage cleared in another
    // tab): show the "start here" state again.
    card.setAttribute("href", match ? match.url : resumeDefault.href);
    if (kicker) kicker.textContent = match ? "Continue where you left off" : resumeDefault.kicker;
    if (title) title.textContent = match ? "Lesson " + match.tag + " — " + match.title : resumeDefault.title;
    if (tag) tag.textContent = match ? match.tag : resumeDefault.tag;
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

  function syncThemeLabel() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    var theme = document.documentElement.getAttribute("data-theme");
    btn.setAttribute("aria-label",
      theme === "light" ? "Switch to dark theme" : "Switch to light theme");
  }

  function initThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      storageSet(THEME_KEY, next);
      syncThemeLabel();
    });
    syncThemeLabel();
  }

  // ── Nav dropdown (hover via CSS; click/keyboard here) ──────────────────

  function initDropdown() {
    var dropdown = document.querySelector("[data-dropdown]");
    if (!dropdown) return;
    var toggle = dropdown.querySelector("[data-dropdown-toggle]");

    function setOpen(open) {
      dropdown.classList.toggle("is-open", open);
      syncExpanded();
    }

    var panel = dropdown.querySelector("[data-dropdown-panel]");
    var canHover = false;
    try { canHover = window.matchMedia("(hover: hover)").matches; } catch (e) { /* no hover */ }

    // Keep the panel inside the viewport (it is anchored to the nav item, which can sit far left).
    function fitPanel() {
      if (!panel) return;
      panel.style.right = "";
      var r = panel.getBoundingClientRect();
      if (!r.width) return; // display:none on small screens
      var vw = document.documentElement.clientWidth, margin = 16, shift = 0;
      if (r.left < margin) shift = margin - r.left;
      else if (r.right > vw - margin) shift = vw - margin - r.right;
      if (shift) panel.style.right = (parseFloat(window.getComputedStyle(panel).right) - shift) + "px";
    }
    // aria-expanded follows what is on screen: pinned open, or shown by hover.
    // The enter/leave handlers pass the answer in, because browsers differ on
    // whether :hover has already changed when those events fire.
    function syncExpanded(hovered) {
      if (hovered === undefined) hovered = dropdown.matches(":hover");
      var shown = dropdown.classList.contains("is-open") ||
        (canHover && hovered && !dropdown.classList.contains("is-dismissed"));
      if (toggle) toggle.setAttribute("aria-expanded", shown ? "true" : "false");
    }
    dropdown.addEventListener("mouseenter", function () { fitPanel(); syncExpanded(true); });
    dropdown.addEventListener("mouseleave", function () { dropdown.classList.remove("is-dismissed"); syncExpanded(false); });
    dropdown.addEventListener("focusin", fitPanel);
    window.addEventListener("resize", fitPanel);
    fitPanel();
    syncExpanded(); // the pointer can already rest on the menu when the page loads
    // Web fonts arriving after this first fit shift the nav: fit again.
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(fitPanel);

    if (toggle) {
      toggle.addEventListener("click", function () {
        fitPanel();
        dropdown.classList.remove("is-dismissed");
        setOpen(!dropdown.classList.contains("is-open"));
      });
    }
    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var hovered = canHover && dropdown.matches(":hover");
      if (!dropdown.classList.contains("is-open") && !hovered) return;
      var hadFocus = dropdown.contains(document.activeElement);
      setOpen(false);
      if (hovered) dropdown.classList.add("is-dismissed");
      syncExpanded();
      if (hadFocus && toggle) toggle.focus();
    });
    dropdown.addEventListener("focusout", function (e) {
      // Only close when focus verifiably moved elsewhere on the page —
      // a null relatedTarget (window blur, etc.) should not slam the menu shut.
      if (e.relatedTarget && !dropdown.contains(e.relatedTarget)) setOpen(false);
    });
    // A page restored from the Back/Forward cache starts un-pinned again; the
    // pointer may still rest on the menu and show it.
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      dropdown.classList.remove("is-dismissed");
      setOpen(false);
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
    var emptyMsg = dialog.querySelector("[data-palette-empty]");

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
      list.hidden = !filtered.length;
      input.setAttribute("aria-expanded", filtered.length ? "true" : "false");
      if (emptyMsg) {
        emptyMsg.hidden = !!filtered.length;
        emptyMsg.textContent = filtered.length ? "" : "No matches — try a lesson tag like “2A”.";
      }
      if (!filtered.length) {
        input.removeAttribute("aria-activedescendant");
        return;
      }
      input.setAttribute("aria-activedescendant", "palette-opt-" + activeIndex);
      for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        var li = document.createElement("li");
        li.className = "palette__item" + (i === activeIndex ? " is-active" : "");
        li.setAttribute("role", "option");
        li.id = "palette-opt-" + i;
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

    function scrollActiveIntoView() {
      var el = list.children[activeIndex];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
    }

    function applyFilter(query) {
      var q = query.trim().toLowerCase();
      filtered = !q ? items.slice() : items.filter(function (item) {
        return (item.tag + " " + item.title).toLowerCase().indexOf(q) !== -1;
      });
      activeIndex = 0;
      render();
      list.scrollTop = 0; // the highlight is back on the first result
    }

    function open() {
      dialog.showModal();
      input.value = "";
      applyFilter("");
      input.focus();
    }

    function go() {
      var item = filtered[activeIndex];
      if (item) { dialog.close(); window.location.assign(item.url); }
    }

    if (openBtn) openBtn.addEventListener("click", open);

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (e.repeat) return;
        if (dialog.open) { dialog.close(); } else { open(); }
      }
    });

    input.addEventListener("input", function () { applyFilter(input.value); });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
        render();
        scrollActiveIntoView();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        render();
        scrollActiveIntoView();
      } else if (e.key === "Enter") {
        e.preventDefault();
        go();
      }
    });

    list.addEventListener("click", function (e) {
      var li = e.target.closest("[data-url]");
      if (li) { dialog.close(); window.location.assign(li.getAttribute("data-url")); }
    });
    list.addEventListener("mousemove", function (e) {
      var li = e.target.closest("[data-idx]");
      if (!li) return;
      var idx = parseInt(li.getAttribute("data-idx"), 10);
      if (idx !== activeIndex) { activeIndex = idx; render(); }
    });

    // Click on the backdrop (the dialog element itself) closes.
    var downOnBackdrop = false;
    dialog.addEventListener("mousedown", function (e) { downOnBackdrop = e.target === dialog; });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog && downOnBackdrop) dialog.close();
      downOnBackdrop = false;
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
    function cleanupReveal(el) {
      // 165ms max stagger + 500ms transition; afterwards hand the element back to its own hover styles
      setTimeout(function () {
        el.classList.remove("reveal", "is-visible");
        el.style.transitionDelay = "";
      }, 800);
    }
    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add("is-visible");
          observer.unobserve(entries[i].target);
          cleanupReveal(entries[i].target);
        }
      }
    }, { threshold: 0, rootMargin: "0px 0px -4% 0px" });

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
          var nowDone = toggle.getAttribute("aria-pressed") !== "true";
          var next = setComplete(lessonSlug, nowDone);
          var saved = isComplete(getCompleteMap(), lessonSlug) === nowDone;
          renderToggle(next, lessonSlug);
          renderAll(next);
          if (nowDone) {
            stampSeal();
            showToast(saved ? "Lesson sealed — progress saved" : "Lesson sealed — but this browser isn’t saving progress");
          } else {
            showToast(saved ? "Marked as not complete" : "Marked as not complete — but this browser isn’t saving progress");
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

  // ── Keeping an already-rendered page current ───────────────────────────

  // Re-read storage and redraw everything that shows progress. Never writes,
  // so two open tabs cannot bounce storage events between each other.
  function refreshProgress() {
    var map = getCompleteMap();
    var slug = document.body.getAttribute("data-lesson-slug");
    if (slug) renderToggle(map, slug);
    renderAll(map);
    renderResumeCard();
  }

  // Back/Forward can restore a page from the browser's cache without running
  // init() again: bring progress, theme and the search palette up to date
  // (the Curriculum menu resets itself in initDropdown).
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return; // normal loads are handled by init()
    var slug = document.body.getAttribute("data-lesson-slug");
    if (slug) setResumeSlug(slug); // this lesson is the one being viewed again
    refreshProgress();
    var theme = storageGet(THEME_KEY);
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
      syncThemeLabel();
    }
    var dialog = document.querySelector("[data-palette]");
    if (dialog && dialog.open) dialog.close();
  });

  // Progress changed in another tab or window.
  window.addEventListener("storage", function (e) {
    if (e.key === null || e.key === COMPLETE_KEY || e.key === RESUME_KEY) refreshProgress();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
