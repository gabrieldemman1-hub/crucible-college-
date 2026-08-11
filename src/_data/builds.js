/**
 * ─────────────────────────────────────────────────────────────────────────────
 * META BUILDS — SINGLE SOURCE OF TRUTH
 *
 * Ten ranked slots for the strongest current-meta Hunter builds. Every build
 * page, card, and prev/next link is generated from this file — edit a slot
 * here and run `npm run build`. All fields are PLACEHOLDERS for you to fill
 * in as the meta shifts; the page structure marks them accordingly.
 *
 * Build fields:
 *   rank     — 1–10, shown in the rank seal
 *   slug     — URL segment; page becomes /builds/<slug>/
 *   name     — placeholder build name (rename when you fill the slot)
 *   subclass — placeholder subclass label
 *   exotic   — placeholder exotic armor piece
 *   weapons  — the loadout display: kinetic / energy / power slots
 *   setup    — author note for the Setup section
 *   howItWorks — author note for the How It Works section
 * ─────────────────────────────────────────────────────────────────────────────
 */

const slots = [
  {
    rank: 1,
    setup: "Full recipe for the current #1 build: subclass config (aspects + fragments), exotic armor, stat priorities, and armor/weapon mods.",
    howItWorks: "Explain the gameplay loop that makes this the strongest build right now — the engagement it forces, the ability rotation, and why it tops the list."
  },
  {
    rank: 2,
    setup: "Setup for the #2 build: aspects, fragments, exotic, stats, mods — and what it trades away compared to #1.",
    howItWorks: "Describe the play pattern and the situations where this build actually beats the #1 pick."
  },
  {
    rank: 3,
    setup: "Setup for the #3 build — call out anything unintuitive in the fragment or mod choices.",
    howItWorks: "Describe the loop, its power spike windows, and the maps or modes where it shines."
  },
  {
    rank: 4,
    setup: "Setup for the #4 build, including the stat spread it needs to function.",
    howItWorks: "Explain the win condition and the counter-play opponents will attempt."
  },
  {
    rank: 5,
    setup: "Setup for the #5 build — note any hard requirements (specific rolls, seasonal mods).",
    howItWorks: "Describe how it plays out in a real lobby and the skill floor it assumes."
  },
  {
    rank: 6,
    setup: "Setup for the #6 build and the cheapest path to assembling it.",
    howItWorks: "Explain the niche it fills — why it ranks here and who should run it."
  },
  {
    rank: 7,
    setup: "Setup for the #7 build, with beginner-friendly substitutions where possible.",
    howItWorks: "Describe the gameplay loop and what it teaches a developing player."
  },
  {
    rank: 8,
    setup: "Setup for the #8 build — flag anything that a recent patch changed.",
    howItWorks: "Explain its matchup spread: what it farms, what farms it."
  },
  {
    rank: 9,
    setup: "Setup for the #9 build and the mods that hold it together.",
    howItWorks: "Describe why it hovers at the edge of the meta and what buff would move it up."
  },
  {
    rank: 10,
    setup: "Setup for the #10 build — a spicy or off-meta-adjacent pick earns this slot.",
    howItWorks: "Explain the surprise factor: what it does that lobbies don't expect."
  }
];

// ── Derived (do not edit) ────────────────────────────────────────────────────

const builds = slots.map((slot) => {
  const nn = String(slot.rank).padStart(2, "0");
  return {
    rank: slot.rank,
    slug: "build-" + nn,
    name: "Build Slot " + nn,
    tagline: "Placeholder for the #" + slot.rank + " Hunter build in the current meta.",
    subclass: "Subclass TBD",
    exotic: "Exotic armor TBD",
    weapons: [
      { slot: "Kinetic", name: "Kinetic weapon TBD", note: "Weapon name, archetype, and the roll that matters." },
      { slot: "Energy", name: "Energy weapon TBD", note: "Weapon name, archetype, and the roll that matters." },
      { slot: "Power", name: "Power weapon TBD", note: "Heavy pick for when ammo drops — or note if it's flexible." }
    ],
    setup: slot.setup,
    howItWorks: slot.howItWorks,
    url: "/builds/build-" + nn + "/"
  };
});

builds.forEach((build, i) => {
  build.prev = i > 0 ? { rank: builds[i - 1].rank, name: builds[i - 1].name, url: builds[i - 1].url } : null;
  build.next = i < builds.length - 1 ? { rank: builds[i + 1].rank, name: builds[i + 1].name, url: builds[i + 1].url } : null;
});

module.exports = { builds };
