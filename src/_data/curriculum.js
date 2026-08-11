/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUCIBLE COLLEGE — SINGLE SOURCE OF TRUTH
 *
 * Every page, route, prev/next link, sidebar, tag, and progress total is
 * derived from this file. To add a chapter or lesson: edit `chapters` below,
 * then run `npm run build`. Nothing else needs to change anywhere.
 *
 * Lesson fields:
 *   tag        — short label shown in the seal ("2A")
 *   slug       — URL segment; page becomes /lessons/<slug>/
 *   title      — lesson title (real content)
 *   objective  — one-line objective (real content)
 *   difficulty — "Beginner" | "Intermediate" | "Advanced"
 *   time       — estimated time, e.g. "12 min"
 *   learningObjectives — 3 bullets (real content)
 *   placeholders       — author notes for the four body sections (PLACEHOLDER)
 *   takeaways          — 3 author notes for Key Takeaways (PLACEHOLDER)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const chapters = [
  {
    number: 1,
    title: "Introduction",
    lessons: [
      {
        tag: "1",
        slug: "1-introduction",
        title: "Introduction",
        objective: "What this course covers, how it is structured, and how to get the most out of it.",
        difficulty: "Beginner",
        time: "8 min",
        learningObjectives: [
          "Understand how the chapters build on each other and why they are ordered this way",
          "Know which Crucible modes this course targets and where its advice applies",
          "Set a realistic practice cadence: one lesson at a time, applied in real matches"
        ],
        placeholders: {
          overview: "Welcome the student: what Crucible College is, why it exists, and what a Hunter will be able to do by the end of the course.",
          keyConcepts: "Lay out the course map — Setup, then Settings, then Movement — and explain why configuration comes before mechanics.",
          commonMistakes: "Address how new players usually try to improve (grinding games with no structure) and why that approach stalls out.",
          practiceDrill: "Give a simple first assignment: play three Control matches and write down what kills you most often."
        },
        takeaways: [
          "State the single biggest promise of the course",
          "Remind that the setup chapters pay off before any aim training does",
          "Set the expected pace — one lesson at a time, applied in real matches"
        ]
      }
    ]
  },
  {
    number: 2,
    title: "Setup",
    lessons: [
      {
        tag: "2A",
        slug: "2a-subclasses",
        title: "Subclasses",
        objective: "Understand the Hunter subclasses and why Void anchors this course's playstyle.",
        difficulty: "Beginner",
        time: "15 min",
        learningObjectives: [
          "Name each Hunter subclass and describe its identity in the Crucible",
          "Understand what aspects and fragments control, at a working level",
          "Pick a starting subclass and commit to it long enough to learn it"
        ],
        placeholders: {
          overview: "Survey the Hunter subclasses — Arc, Solar, Void, Strand, Stasis, Prismatic — and what each one is actually for in PvP.",
          keyConcepts: "Explain aspects, fragments, and the dodge economy; establish why this course leans on Void as its anchor.",
          commonMistakes: "Cover subclass-hopping every match and copying builds without understanding what the pieces do.",
          practiceDrill: "Have the student equip the recommended starting subclass and play five matches without changing anything."
        },
        takeaways: [
          "Name the recommended starting subclass and give the one-line reason",
          "One sentence on what aspects vs. fragments each control",
          "Dodge is a resource — spend it deliberately, not on cooldown"
        ]
      },
      {
        tag: "2B",
        slug: "2b-what-is-meta",
        title: "What is Meta",
        objective: "What “meta” means, why it exists, and how to read it without chasing it.",
        difficulty: "Beginner",
        time: "10 min",
        learningObjectives: [
          "Define the meta and understand where it comes from (sandbox patches, usage data)",
          "Know where to check the current Crucible meta each season",
          "Judge when to follow the meta and when a comfort pick is the better choice"
        ],
        placeholders: {
          overview: "Define “meta” plainly and frame it as a moving snapshot of what the current sandbox rewards — not a rulebook.",
          keyConcepts: "Explain sandbox patches, usage stats, and how to tell a genuine meta pick from a content-creator fad.",
          commonMistakes: "Warn against chasing every meta shift, and equally against refusing the meta on principle.",
          practiceDrill: "Ask the student to look up current Crucible usage stats and identify the top three weapon archetypes."
        },
        takeaways: [
          "Meta is descriptive, not prescriptive — say that in one line",
          "Name where to check the current state of the sandbox each season",
          "State when comfort picks legitimately beat meta picks"
        ]
      },
      {
        tag: "2C",
        slug: "2c-meta-loadouts",
        title: "Meta Loadouts",
        objective: "Build one competitive Hunter loadout from current meta weapons and exotics — and commit to it.",
        difficulty: "Intermediate",
        time: "15 min",
        learningObjectives: [
          "Understand primary/special pairing logic and engagement ranges",
          "Know the standard Hunter exotic armor choices for PvP and what each enables",
          "Assemble one loadout to learn on instead of rotating every match"
        ],
        placeholders: {
          overview: "Turn the meta literacy from 2B into one concrete Hunter loadout the student will actually learn on.",
          keyConcepts: "Explain primary/special range pairing, engagement distance, and the Hunter exotic armor shortlist.",
          commonMistakes: "Cover mismatched range pairings and swapping loadouts every match instead of learning one deeply.",
          practiceDrill: "Build the recommended loadout (or the closest owned equivalent) and commit to it for ten matches."
        },
        takeaways: [
          "Name the one loadout to commit to and its engagement plan",
          "Give the rule of thumb for pairing primary and special ranges",
          "Name the exotic armor pick and the habit it is meant to build"
        ]
      },
      {
        tag: "2D",
        slug: "2d-armor-and-weapon-mods",
        title: "Armor and Weapon Mods",
        objective: "Which mods actually matter in PvP, and how to slot them without PvE noise.",
        difficulty: "Intermediate",
        time: "12 min",
        learningObjectives: [
          "Identify the PvP-relevant mod families: targeting, dexterity, and unflinching",
          "Understand the stat priorities a Crucible Hunter should build toward",
          "Audit and rebuild a mod setup so every slot earns its place in PvP"
        ],
        placeholders: {
          overview: "Explain which armor and weapon mods measurably change PvP outcomes, and which are PvE noise to strip out.",
          keyConcepts: "Cover targeting, dexterity, and unflinching mods, plus the stat priorities a Crucible Hunter builds toward.",
          commonMistakes: "Address copying PvE mod setups into Crucible and ignoring stat breakpoints entirely.",
          practiceDrill: "Audit the current armor set: list every equipped mod and replace the ones that do nothing in PvP."
        },
        takeaways: [
          "Name the three mod families that matter in the Crucible",
          "Give the stat priority order for a PvP Hunter",
          "Mods sharpen a build — they don't fix a bad one"
        ]
      }
    ]
  },
  {
    number: 3,
    title: "Video Settings and Radar Settings",
    lessons: [
      {
        tag: "3A",
        slug: "3a-video-settings-setup",
        title: "Video Settings Setup",
        objective: "Configure video settings for clarity and framerate over eye candy.",
        difficulty: "Beginner",
        time: "12 min",
        learningObjectives: [
          "Understand the FOV tradeoff and pick a value that serves information, not looks",
          "Know which post-processing effects to disable and why they cost you fights",
          "Prioritize a stable framerate over visual fidelity, and apply a baseline config"
        ],
        placeholders: {
          overview: "Frame the goal: a clear, high-framerate image beats a pretty one — every setting here serves target visibility.",
          keyConcepts: "Walk through FOV, motion blur, chromatic aberration, film grain, and the framerate-vs-fidelity tradeoff.",
          commonMistakes: "Cover maxed-out graphics presets, FOV chosen for looks over information, and uncapped, inconsistent framerates.",
          practiceDrill: "Apply the recommended baseline, then play one match and note what became easier to see."
        },
        takeaways: [
          "State the recommended FOV range and the reasoning",
          "List the settings to always disable",
          "A stable framerate beats pretty frames, every time"
        ]
      },
      {
        tag: "3B",
        slug: "3b-radar-setup",
        title: "Radar Setup",
        objective: "Read the radar accurately and build the habit of checking it before the fight starts.",
        difficulty: "Beginner",
        time: "10 min",
        learningObjectives: [
          "Decode how the radar's segments and brightness encode direction and proximity",
          "Know when radar information is stale or hidden (crouching enemies, verticality)",
          "Build a glance cadence so radar checks happen between engagements, not during"
        ],
        placeholders: {
          overview: "Frame why radar configuration and radar literacy change what you can react to before the fight even starts.",
          keyConcepts: "Explain how the radar's segments and brightness encode direction and proximity, and when that information goes stale.",
          commonMistakes: "Cover tunnel-visioning on the crosshair, misreading vertical positions, and forgetting that crouched enemies vanish from radar.",
          practiceDrill: "Play one match calling out — out loud — which direction the nearest enemy is, using radar alone."
        },
        takeaways: [
          "What each radar ring and segment actually tells you",
          "The cadence for glancing at radar between engagements",
          "Radar tells you where — not when, and not how many"
        ]
      },
      {
        tag: "3C",
        slug: "3c-crouch-bind-setup",
        title: "Crouch Bind Setup",
        objective: "Rebind crouch so you can slide and radar-dodge without breaking your aim.",
        difficulty: "Beginner",
        time: "8 min",
        learningObjectives: [
          "Understand why the default crouch bind blocks sliding mid-fight",
          "Evaluate candidate binds for controller and mouse/keyboard",
          "Commit to one bind and drill it until it is muscle memory"
        ],
        placeholders: {
          overview: "Explain why the default crouch bind forces you off your aim, and what a good bind unlocks in a duel.",
          keyConcepts: "Cover candidate binds for controller (paddles, stick-click) and mouse/keyboard, with the tradeoffs of each.",
          commonMistakes: "Address keeping a bind that breaks your aim, and switching binds so often that no muscle memory forms.",
          practiceDrill: "Set the new bind, then spend ten minutes in a private match sliding around corners until it feels automatic."
        },
        takeaways: [
          "Name the bind chosen and what it frees your fingers to do",
          "Expect a short performance dip while the bind becomes automatic",
          "Crouch is also a radar tool, not just a slide input"
        ]
      }
    ]
  },
  {
    number: 4,
    title: "Movement on Hunter",
    lessons: [
      {
        tag: "4A",
        slug: "4a-why-strafe-jump-is-the-best",
        title: "Why Strafe Jump is the Best",
        objective: "Why Strafe Jump outperforms the other Hunter jumps in a PvP duel.",
        difficulty: "Intermediate",
        time: "12 min",
        learningObjectives: [
          "Compare Hunter's jump options and their air-control profiles",
          "Understand why predictable jump arcs get you killed in duels",
          "Know the niche cases where High Jump or Triple Jump still make sense"
        ],
        placeholders: {
          overview: "Make the case: compare Hunter's jump options head-to-head and show why Strafe Jump wins duels.",
          keyConcepts: "Explain air control, arc predictability, and how Strafe Jump preserves strafe speed while airborne.",
          commonMistakes: "Cover floaty high jumps taken in open lanes, and jumping in straight, readable arcs.",
          practiceDrill: "In a private match, fight one lane using only Strafe Jump and note how often opponents miss their first shot."
        },
        takeaways: [
          "Why air control beats height in a duel — one line",
          "The niche cases where the other jumps are acceptable",
          "Predictable arcs get you killed — vary the jump"
        ]
      },
      {
        tag: "4B",
        slug: "4b-how-to-move-efficiently-as-a-hunter",
        title: "How to Move Efficiently as a Hunter",
        objective: "Chain slides, Strafe Jumps, and dodges into movement that is hard to read and hard to hit.",
        difficulty: "Intermediate",
        time: "18 min",
        learningObjectives: [
          "Drill the core slide-into-jump movement chain until it is automatic",
          "Place dodges into cover — never onto open ground",
          "Route through map lanes with cover discipline instead of moving for style"
        ],
        placeholders: {
          overview: "Bring the course together: chain slide, Strafe Jump, and dodge into movement that opponents cannot read.",
          keyConcepts: "Cover the slide-to-jump chain, dodge placement (into cover, never open ground), and lane-to-lane routing.",
          commonMistakes: "Address dodging in the open, sliding into unfavourable duels, and movement for its own sake with no map purpose.",
          practiceDrill: "Set a route through a familiar map touching three lanes; run it repeatedly, chaining movement without stopping."
        },
        takeaways: [
          "Name the core movement chain to drill until automatic",
          "Dodge to cover — never to open ground",
          "Movement's job is better positions, not style points"
        ]
      }
    ]
  }
];

// ── Derived views (do not edit — everything below is computed) ───────────────

// Flat teaching sequence with prev/next links and chapter context baked in.
const lessons = [];
chapters.forEach((chapter) => {
  chapter.lessons.forEach((lesson) => {
    lessons.push(Object.assign({}, lesson, {
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      url: "/lessons/" + lesson.slug + "/"
    }));
  });
});
lessons.forEach((lesson, i) => {
  lesson.index = i;
  lesson.prev = i > 0
    ? { tag: lessons[i - 1].tag, title: lessons[i - 1].title, url: lessons[i - 1].url }
    : null;
  lesson.next = i < lessons.length - 1
    ? { tag: lessons[i + 1].tag, title: lessons[i + 1].title, url: lessons[i + 1].url }
    : null;
});

// Minimal index shipped to the browser for the Resume control.
const index = lessons.map((l) => ({ slug: l.slug, tag: l.tag, title: l.title, url: l.url }));

module.exports = { chapters, lessons, index };
