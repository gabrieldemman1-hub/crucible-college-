#!/usr/bin/env node
// Renders poc/review/calls.json into poc/review/index.html: one static page, no dependencies,
// suitable for opening locally or publishing as a private artifact.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "calls.json"), "utf8"));

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";
const LANG = { en: "English", es: "Spanish", other: "Other language", unknown: "Language unknown" };
const TYPE = { new_client: "New client", existing_client: "Existing client", other: "Other matter", unknown: "Type unknown" };
const TONE = { transferred_successfully: "good", existing_client_transferred: "good", other_matter_transferred: "good", transfer_failed_message_taken: "warn", hung_up_while_holding: "warn", abandoned: "warn", spam: "muted" };

function kv(obj, omit = []) {
  return `<dl class="kv">` + Object.entries(obj).filter(([k]) => !omit.includes(k)).map(([k, v]) =>
    `<div><dt>${esc(k)}</dt><dd>${esc(v === "" ? "—" : v)}</dd></div>`).join("") + `</dl>`;
}

function callHtml(c, i) {
  const a = c.analysis || {};
  const sf = c.salesforce;
  const tone = TONE[sf.dispositionKey] || "muted";
  const flags = [];
  if (a.legal_information_given) flags.push(`<span class="pill bad">Legal information given</span>`);
  if (a.disclosure_given === false) flags.push(`<span class="pill bad">Disclosure missing</span>`);
  if (a.asked_for_senior_management) flags.push(`<span class="pill">Asked for ${esc(a.requested_person || "senior management")}</span>`);

  const transcript = (c.transcript || []).map((u) =>
    `<div class="line ${u.role === "agent" ? "agent" : u.role === "user" ? "caller" : "other"}"><span class="who">${u.role === "agent" ? esc(data.names.agent) : u.role === "user" ? "Caller" : "Staff"}</span><span class="what">${esc(u.content)}</span></div>`).join("");

  const heard = (c.whisperHeard || []).length
    ? `<h4>What the staff phone heard</h4>${c.whisperHeard.map((u) => `<p class="quiet">${esc(u.content)}</p>`).join("")}`
    : "";

  const attempts = (sf.attempts || []).length
    ? `<p class="attempts">${sf.attempts.map((t) => `<span class="pill ${t.succeeded ? "good" : "warn"}">${esc(t.tool.replace("transfer_to_", "→ "))} ${t.succeeded ? "answered" : "no answer"}</span>`).join(" ")}</p>`
    : `<p class="attempts"><span class="pill muted">No transfer attempted</span></p>`;

  return `
<article class="call" id="call-${i + 1}">
  <header class="call-head">
    <div class="call-title">
      <span class="eyebrow">Call ${i + 1}${data.sample ? " · example" : ""}</span>
      <h2>${esc(a.caller_full_name || "Unnamed caller")}</h2>
      <p class="meta"><span>${esc(fmtTime(c.started_at))}</span><span>${c.duration_s}s</span><span class="mono">${esc(c.from_number || "no caller id")}</span></p>
    </div>
    <div class="pills">
      <span class="pill">${esc(LANG[a.language] || LANG.unknown)}</span>
      <span class="pill">${esc(TYPE[a.caller_type] || TYPE.unknown)}</span>
      <span class="pill ${tone}">${esc(sf.disposition)}</span>
      ${flags.join("")}
    </div>
  </header>
  <div class="call-body">
    <section class="transcript" aria-label="Transcript">
      <h3><span class="dot real"></span>Transcript</h3>
      <div class="lines">${transcript || `<p class="quiet">No transcript.</p>`}</div>
      ${a.reason ? `<p class="reason"><strong>Reason, in the caller's words:</strong> ${esc(a.reason)}</p>` : ""}
    </section>
    <div class="cards">
      <section class="card">
        <h3><span class="dot preview"></span>Routing</h3>
        <p class="lead-line">${c.routing.target ? `${esc(c.routing.list)} → <strong>${esc(c.routing.target.name)}</strong> <span class="mono">${esc(c.routing.target.number)}</span>` : `${esc(c.routing.list)} → <strong>no transfer</strong>`}</p>
        <ul>${c.routing.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        ${attempts}
      </section>
      <section class="card">
        <h3><span class="dot real"></span>Briefing whispered to ${esc(c.routing.target?.name || "staff")}</h3>
        <blockquote>${esc(c.briefing)}</blockquote>
        ${heard}
      </section>
      <section class="card">
        <h3><span class="dot preview"></span>Salesforce preview</h3>
        ${sf.lead ? `<h4>Lead</h4>${kv(sf.lead)}` : ""}
        ${sf.contactTask ? `<h4>Task on existing Contact</h4>${kv(sf.contactTask)}` : ""}
        ${sf.task ? `<h4>Task</h4>${kv(sf.task, ["Description"])}` : ""}
        <h4>Note</h4><p class="mono small">${esc(sf.note.Title)}</p>
        <ul class="explain">${sf.explanation.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      </section>
    </div>
  </div>
</article>`;
}

const scenarios = [
  "New client, English, confirms caller id",
  "New client, Spanish",
  "Existing client → admin",
  "Asks for Walter → intake, never Walter",
  "\"Do I have a case?\" deflected",
  "Nobody answers → fallback message and Task",
];

const html = `<title>Maya Call Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{
  --bg:#f5f7f9; --surface:#ffffff; --surface-2:#eef2f5; --ink:#1a2430; --muted:#5b6876; --line:#d9e0e7;
  --accent:#0f5c6e; --accent-ink:#0b4553; --preview:#8a5a1b; --preview-bg:#fbf3e6;
  --good:#1f7a4d; --good-bg:#e6f4ec; --warn:#a15c00; --warn-bg:#fdf1e0; --bad:#a83232; --bad-bg:#fbe9e9;
  --caller-bg:#eaf3f5; --agent-bg:#f2f4f6; --radius:10px;
  --sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif; --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#111820; --surface:#18212b; --surface-2:#1f2a36; --ink:#e6ebf0; --muted:#9aa7b4; --line:#2b3744;
  --accent:#5fb6c9; --accent-ink:#8fd0de; --preview:#e0a85a; --preview-bg:#2b2416;
  --good:#5fc98a; --good-bg:#16301f; --warn:#e0a85a; --warn-bg:#2f2312; --bad:#e07a7a; --bad-bg:#3a1c1c;
  --caller-bg:#16262c; --agent-bg:#1c2632;
}}
:root[data-theme="dark"]{
  --bg:#111820; --surface:#18212b; --surface-2:#1f2a36; --ink:#e6ebf0; --muted:#9aa7b4; --line:#2b3744;
  --accent:#5fb6c9; --accent-ink:#8fd0de; --preview:#e0a85a; --preview-bg:#2b2416;
  --good:#5fc98a; --good-bg:#16301f; --warn:#e0a85a; --warn-bg:#2f2312; --bad:#e07a7a; --bad-bg:#3a1c1c;
  --caller-bg:#16262c; --agent-bg:#1c2632;
}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.5;margin:0}
.wrap{max-width:1180px;margin:0 auto;padding-block:28px 48px;padding-inline:20px}
h1,h2,h3,h4{margin:0;text-wrap:balance;line-height:1.2}
h1{font-size:1.75rem;font-weight:600}
h2{font-size:1.25rem;font-weight:600}
h3{font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:8px;margin-bottom:10px}
h4{font-size:.78rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
p{margin:0}
ul{margin:0;padding-left:18px}
li{margin:2px 0}
.mono{font-family:var(--mono);font-size:.9em}
.small{font-size:.85rem}
.quiet{color:var(--muted)}
.eyebrow{font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.top{display:flex;flex-wrap:wrap;gap:20px 40px;align-items:flex-end;justify-content:space-between;margin-bottom:22px}
.top p{color:var(--muted);max-width:62ch}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.85rem;color:var(--muted)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.dot.real{background:var(--accent)}
.dot.preview{background:var(--preview)}
.banner{background:var(--preview-bg);color:var(--preview);border:1px solid color-mix(in srgb,var(--preview) 35%,transparent);border-radius:var(--radius);padding:10px 14px;font-size:.9rem;margin-bottom:22px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px}
.staff{display:grid;gap:8px}
.staff div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed var(--line);padding-bottom:6px}
.staff div:last-child{border-bottom:0}
.scenarios{list-style:none;padding:0;display:grid;gap:6px;counter-reset:s}
.scenarios li{display:flex;gap:10px;align-items:baseline;counter-increment:s}
.scenarios li::before{content:counter(s);font-family:var(--mono);font-size:.8rem;color:var(--muted);width:1.4em;flex:none}
.call{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:22px;overflow:hidden}
.call-head{display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:flex-start;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--surface-2)}
.meta{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:.9rem;margin-top:4px}
.pills{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pill{display:inline-block;font-size:.78rem;font-weight:500;padding:3px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--ink);white-space:nowrap}
.pill.good{background:var(--good-bg);color:var(--good);border-color:transparent}
.pill.warn{background:var(--warn-bg);color:var(--warn);border-color:transparent}
.pill.bad{background:var(--bad-bg);color:var(--bad);border-color:transparent}
.pill.muted{background:var(--surface-2);color:var(--muted);border-color:transparent}
.call-body{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:0}
.transcript{padding:16px 18px;border-right:1px solid var(--line)}
.lines{display:grid;gap:8px;max-height:520px;overflow:auto;padding-right:6px}
.line{display:grid;grid-template-columns:64px 1fr;gap:10px;padding:8px 10px;border-radius:8px;font-size:.93rem}
.line.agent{background:var(--agent-bg)}
.line.caller{background:var(--caller-bg)}
.line.other{background:var(--preview-bg)}
.who{font-size:.72rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding-top:3px}
.reason{margin-top:12px;font-size:.9rem;color:var(--muted)}
.cards{display:grid;gap:0}
.card{padding:16px 18px;border-bottom:1px solid var(--line)}
.card:last-child{border-bottom:0}
.lead-line{margin-bottom:8px}
.attempts{margin-top:10px}
blockquote{margin:0;padding:12px 14px;border-left:3px solid var(--accent);background:var(--surface-2);border-radius:0 8px 8px 0;font-style:italic}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:0;font-size:.9rem}
.kv div{display:contents}
.kv dt{font-family:var(--mono);font-size:.8rem;color:var(--muted);padding-top:2px}
.kv dd{margin:0;overflow-wrap:anywhere}
.explain{margin-top:12px;font-size:.88rem;color:var(--muted)}
footer{margin-top:32px;color:var(--muted);font-size:.85rem}
@media (max-width:820px){
  .grid2{grid-template-columns:1fr}
  .call-body{grid-template-columns:1fr}
  .transcript{border-right:0;border-bottom:1px solid var(--line)}
  .lines{max-height:360px}
  .kv{grid-template-columns:1fr}
  .kv dt{padding-top:6px}
}
@media (prefers-reduced-motion: no-preference){ .lines{scroll-behavior:smooth} }
</style>
<div class="wrap">
  <header class="top">
    <div>
      <span class="eyebrow">Proof of concept</span>
      <h1>${esc(data.names.agent)} call review</h1>
      <p>Every call ${esc(data.names.agent)} answered, with the routing decision, the briefing the staff member heard, and the Salesforce record the production system would create. Generated ${esc(fmtTime(data.generated_at))}.</p>
    </div>
    <div class="legend"><span><i class="dot real"></i>Real: happened on the call</span><span><i class="dot preview"></i>Preview: computed from the call, not written anywhere</span></div>
  </header>
  ${data.sample ? `<div class="banner">These two calls are examples written by hand to show the page before any real test calls exist. Real calls replace them the first time <span class="mono">pull-calls.mjs</span> runs.</div>` : ""}
  <div class="grid2">
    <section class="panel">
      <h3>Demo routing list</h3>
      <div class="staff">
        <div><span>Intake (English and Spanish)</span><span><strong>${esc(data.staff.intake.name)}</strong> <span class="mono">${esc(data.staff.intake.number)}</span></span></div>
        <div><span>Admin</span><span><strong>${esc(data.staff.admin.name)}</strong> <span class="mono">${esc(data.staff.admin.number)}</span></span></div>
        <div><span>Overnight</span><span><strong>${esc(data.staff.intake.name)}</strong> <span class="quiet">new clients only</span></span></div>
      </div>
    </section>
    <section class="panel">
      <h3>Demo scenarios</h3>
      <ol class="scenarios">${scenarios.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    </section>
  </div>
  ${data.calls.length ? data.calls.map(callHtml).join("\n") : `<p class="quiet">No calls yet. Place a test call, then run pull-calls.mjs and build-page.mjs.</p>`}
  <footer>Transcribed, not recorded. Names and numbers on this page belong to test callers. Production design: PLAN-v2.md.</footer>
</div>
`;

writeFileSync(join(here, "index.html"), html);
console.log(`wrote ${join(here, "index.html")} (${data.calls.length} call(s), ${(html.length / 1024).toFixed(1)} KB)`);
