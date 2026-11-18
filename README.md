# Crucible College

A structured Destiny 2 Crucible (PvP) course for the Hunter class, aimed at
beginner-to-intermediate players. Static site, no backend, no accounts.

## Stack

**[Eleventy (11ty)](https://www.11ty.dev/)** with Nunjucks templates.

Why: the entire curriculum lives in **one data file**, and Eleventy generates one
HTML page per lesson from a single template — so adding lessons never means
copying boilerplate, and prev/next links, sidebars, tags, and progress totals
can never drift out of sync. The output is plain static HTML/CSS/JS with no
client-side framework, deployable to any host (Netlify, GitHub Pages, S3,
Cloudflare Pages — anything that serves files). The accepted tradeoff: you need
Node and a build step; in exchange you never hand-maintain links across 10+
near-identical pages.

## Run locally

Requires Node 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:8080. `npm run dev` rebuilds and reloads on every
file change. For a production build (output in `_site/`, which is emptied
first so pages for renamed or removed lessons don't linger):

```bash
npm run build
```

Deploy by uploading `_site/` to any static host. The build includes a
`404.html`, which most static hosts serve automatically for unknown addresses.

> Note: every URL on the site is root-relative (`/lessons/...`,
> `/assets/...`), so it only works when served from a domain root: a custom
> domain, Netlify, Cloudflare Pages, or a GitHub Pages user/organisation site.
> It does not work from a subpath such as a GitHub Pages project site
> (`username.github.io/repo/`) — Eleventy's `pathPrefix` has no effect on
> these URLs, so subpath hosting would need code changes.

## Where the curriculum lives

**`src/_data/curriculum.js` is the single source of truth.** Chapters, lesson
titles, order, slugs, tags, objectives, difficulty, estimated time, learning
objectives, and every placeholder note live there. Everything else is derived
from it at build time:

- one page per lesson at `/lessons/<slug>/`
- prev/next pager links (in teaching order, across chapter boundaries)
- the curriculum page, chapter sidebars, breadcrumbs, and the nav dropdown menu
- the "X of N complete" totals, the command palette index, and the Home-page
  chapter list

**Meta Builds live in `src/_data/builds.js`** — ten ranked placeholder slots.
Each slot generates a card on `/builds/` and a detail page at
`/builds/build-NN/`, or `/builds/<slug>/` once the slot sets a `slug`
(rank seal, subclass/exotic pills, three-weapon loadout
display with image placeholders, Setup and How It Works sections, and
higher/lower-rank pager). Fill a slot by adding `name`, `tagline`, `subclass`,
`exotic` and `weapons` to its entry there (the header comment lists every
field) and rebuilding; anything you leave out keeps its placeholder text.

## Adding a new chapter (or lesson)

1. Open `src/_data/curriculum.js`.
2. Add a new object to the `chapters` array (or a new lesson object to an
   existing chapter's `lessons` array), following the same shape as the
   existing entries — `tag`, `slug`, `title`, `objective`, `difficulty`,
   `time`, `learningObjectives` (3), `placeholders` (4 notes), `takeaways` (3).
3. Run:

```bash
npm run build
```

That's it. No other file needs editing — routes, pager links, sidebars,
curriculum cards, and progress totals all regenerate from the data.

## Writing the real lesson content

Every placeholder is marked with a dashed **"Placeholder"** chip in the
rendered page and is greppable in source: search for `data-placeholder` (markup)
or `PLACEHOLDER` (comments). The four body sections and takeaway notes come
from each lesson's `placeholders`/`takeaways` fields in `curriculum.js` — to
write real prose, replace the placeholder blocks in
`src/_includes/lesson.njk` with your content source of choice (e.g. per-lesson
Markdown files wired into the data cascade). The video slot on each lesson
page is a sized 16:9 container — swap the `.video-slot` block for a
YouTube/Vimeo `<iframe>`.

## Design & themes

The visual identity is **Void Kinetic** — the Void Hunter palette with motion as
a first-class element: the wordmark seal spins on hover, nav underlines slide
in, cards spring on hover, the hero italic carries a slow sheen, and a glossary
ticker idles on the Home page. All motion is disabled under
`prefers-reduced-motion`.

**Light and dark themes** are built in. The site follows the visitor's system
preference on first visit; the sun/moon button in the nav overrides it, and the
choice persists in `localStorage["crucible-college:theme:v1"]`. Both palettes
live at the top of `src/assets/styles.css` as CSS custom properties (`:root`
for dark, `:root[data-theme="light"]` for light) — every component reads the
same variables, so restyling either theme is a token edit, not a hunt. An
inline script in `base.njk` sets the theme attribute before first paint to
prevent flashing.

## Interface features

All implemented in `src/assets/progress.js` + `styles.css`, no frameworks:

- **Curriculum dropdown** — hovering (or clicking the chevron) on Curriculum
  in the nav opens a menu of every chapter and lesson, with gold ticks on
  completed lessons. Keyboard: the chevron button toggles it, Esc closes.
  Hidden on small screens (the curriculum page covers it there).
- **Command palette** — Ctrl/⌘+K (or the search pill in the nav) opens a
  quick-switcher over every top-level page and lesson (the individual build
  pages are not in it); type to filter, arrows + Enter to jump.
- **Progress ring** — the nav progress counter includes an SVG ring that
  fills violet and turns gold when every lesson is complete.
- **Read-progress bar** — a 2px bar under the header on lesson pages tracks
  scroll position (on phones, where the header scrolls away, it is pinned to
  the top of the window instead).
- **Completion feedback** — marking a lesson complete stamps the lesson seal
  (a quick scale animation) and shows a "progress saved" toast.
- **Motion** — scroll-reveal on cards/sections (IntersectionObserver) and
  cross-page fades (View Transitions API, progressive enhancement). Every
  animation is disabled under `prefers-reduced-motion`.

## How progress tracking works

All client-side, in `src/assets/progress.js` (the only external script,
loaded by every page; `base.njk` also carries a small inline theme script):

- **Completion** — "Mark as complete" writes
  `localStorage["crucible-college:complete:v1"]` (a `{slug: true}` map). On
  every page load the script re-renders: the lesson toggle, gold-filled seals
  and ticks in the chapter sidebar, "Completed" pills on curriculum cards, the
  curriculum progress bar, and the "X / N" counter in the top nav. It does the
  same when you come back to a page with the browser's Back button, or change
  progress in another tab.
- **Resume** — every lesson page view writes its slug to
  `localStorage["crucible-college:resume:v1"]`. The Home page's "Continue
  training" card reads it and deep-links to that lesson; with no history it
  shows a "start at the beginning" state pointing at Lesson 1.
- **Degradation** — all storage access is wrapped in try/catch. If storage is
  blocked, the site works normally; completion just doesn't persist, and the
  toast says so.

The lesson total is never hardcoded — it's rendered from `curriculum.js` at
build time, so it stays correct as chapters are added.

## Project layout

```
├── .eleventy.js              # build config
├── src/
│   ├── _data/curriculum.js   # ★ SINGLE SOURCE OF TRUTH — edit this
│   ├── _data/builds.js       # Meta Builds slots
│   ├── _includes/base.njk    # HTML shell: nav, progress, footer
│   ├── _includes/lesson.njk  # lesson page template
│   ├── _includes/build.njk   # build page template
│   ├── lessons.njk           # generates one page per lesson
│   ├── build-pages.njk       # generates one page per build
│   ├── index.njk             # Home
│   ├── curriculum.njk        # Curriculum
│   ├── builds.njk            # Meta Builds (ranked list)
│   ├── dictionary.njk        # Dictionary (A–Z Crucible glossary)
│   ├── resources.njk         # Resources (external links)
│   ├── 404.njk               # "Page not found" page (/404.html)
│   └── assets/
│       ├── styles.css        # design system (Void Hunter)
│       └── progress.js       # progress tracking + all UI behaviours
└── _site/                    # build output (deploy this)
```

`tracker/` and `design-explorations/` are separate from the site and are not
part of the build.
