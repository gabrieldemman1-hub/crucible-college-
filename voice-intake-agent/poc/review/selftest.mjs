#!/usr/bin/env node
// Runs the review pipeline (summarize -> Salesforce preview -> page) over call shapes Retell can
// return that the two hand-written samples don't cover. No key or network needed.
// Usage: node poc/review/selftest.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize, loadConfig } from "./pull-calls.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig();
let failures = 0;
const check = (name, cond, detail = "") => { console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond || !detail ? "" : `  (${detail})`}`); if (!cond) failures++; };
const t0 = Date.UTC(2026, 8, 22, 17, 12); // a Tuesday, 10:12 PT

const tools = (name, result, successful) => [
  { role: "tool_call_invocation", name, arguments: "{}", tool_call_id: "t1" },
  { role: "tool_call_result", content: result, tool_call_id: "t1", successful },
];

const cases = [
  {
    name: "call ended before any analysis (no call_analysis, no transcript)",
    call: { call_id: "c_bare", start_timestamp: t0, end_timestamp: t0 + 4000, duration_ms: 4000, from_number: "+14155550111", disconnection_reason: "user_hangup", call_status: "ended" },
    expect: (s) => [
      ["disposition abandoned", s.salesforce.dispositionKey === "abandoned", s.salesforce.dispositionKey],
      ["lead phone falls back to caller id", s.salesforce.lead?.Phone === "+14155550111", s.salesforce.lead?.Phone],
      ["lead name placeholder, not blank", s.salesforce.lead?.LastName === "Unknown Caller", s.salesforce.lead?.LastName],
      ["briefing renders without throwing", typeof s.briefing === "string"],
    ],
  },
  {
    name: "silent call marked as spam by Retell",
    call: { call_id: "c_spam", start_timestamp: t0, end_timestamp: t0 + 12000, duration_ms: 12000, from_number: "+18005550100", disconnection_reason: "marked_as_spam", call_status: "ended", call_analysis: { custom_analysis_data: {} } },
    expect: (s) => [["disposition spam", s.salesforce.dispositionKey === "spam", s.salesforce.dispositionKey]],
  },
  {
    name: "new client, Spanish, intake phone rang out (dial_no_answer), message taken",
    call: {
      call_id: "c_noanswer", start_timestamp: t0, end_timestamp: t0 + 95000, duration_ms: 95000, from_number: "+16505550123", disconnection_reason: "agent_hangup", call_status: "ended",
      call_analysis: { call_summary: "Spanish-speaking new client; transfer not answered.", custom_analysis_data: { disclosure_given: true, caller_type: "new_client", language: "es", caller_full_name: "Carlos Mendoza", callback_phone: "650-555-0123", reason: "No me pagaron mis últimas dos semanas", asked_for_senior_management: false, requested_person: "", message_taken: true, legal_information_given: false } },
      transcript_object: [{ role: "agent", content: "Gracias por llamar." }, { role: "user", content: "Hola, soy nuevo." }],
      transcript_with_tool_calls: [{ role: "agent", content: "Gracias por llamar." }, ...tools("transfer_to_intake", "Transfer failed: no answer", false)],
    },
    expect: (s) => [
      ["routed to intake Spanish list", s.routing.list === "intake.es", s.routing.list],
      ["disposition transfer failed, message taken", s.salesforce.dispositionKey === "transfer_failed_message_taken", s.salesforce.dispositionKey],
      ["a callback Task is previewed", Boolean(s.salesforce.task), JSON.stringify(s.salesforce.task)],
      ["phone normalized to E.164", s.salesforce.lead?.Phone === "+16505550123", s.salesforce.lead?.Phone],
      ["lead language Spanish", /es|spanish/i.test(JSON.stringify(s.salesforce.lead)), ""],
      ["briefing mentions the caller", s.briefing.includes("Carlos Mendoza"), s.briefing],
    ],
  },
  {
    name: "existing client, English, transfer bridged, callback number is caller id",
    call: {
      call_id: "c_existing", start_timestamp: t0 + 60000, end_timestamp: t0 + 120000, duration_ms: 60000, from_number: "+14155550222", disconnection_reason: "call_transfer", call_status: "ended",
      call_analysis: { custom_analysis_data: { disclosure_given: true, caller_type: "existing_client", language: "en", caller_full_name: "Priya Natarajan", callback_phone: "CALLER_ID", reason: "checking on my case status", asked_for_senior_management: false, requested_person: "", message_taken: false, legal_information_given: false } },
      transcript_object: [{ role: "agent", content: "Hi." }],
      transcript_with_tool_calls: [{ role: "agent", content: "Hi." }, ...tools("transfer_to_admin", "Transfer bridged", true)],
    },
    expect: (s) => [
      ["routed to admin", s.routing.list === "admin", s.routing.list],
      ["disposition existing client transferred", s.salesforce.dispositionKey === "existing_client_transferred", s.salesforce.dispositionKey],
      ["caller id used as phone", s.salesforce.lead?.Phone === "+14155550222" || s.salesforce.contactTask, JSON.stringify(s.salesforce.lead?.Phone)],
      ["briefing is the admin wording", /existing client/i.test(s.briefing), s.briefing],
    ],
  },
  {
    name: "caller asked for Walter, routed to intake, whisper adds the ask",
    call: {
      call_id: "c_walter", start_timestamp: t0 + 120000, end_timestamp: t0 + 200000, duration_ms: 80000, from_number: "+14155550333", disconnection_reason: "call_transfer", call_status: "ended",
      call_analysis: { custom_analysis_data: { disclosure_given: true, caller_type: "new_client", language: "en", caller_full_name: "Tom Reyes", callback_phone: "CALLER_ID", reason: "wrongful termination.", asked_for_senior_management: true, requested_person: "Walter", message_taken: false, legal_information_given: false } },
      transcript_object: [{ role: "user", content: "Can I speak to Walter?" }],
      transcript_with_tool_calls: [{ role: "user", content: "Can I speak to Walter?" }, ...tools("transfer_to_intake", "Transfer bridged", true)],
    },
    expect: (s) => [
      ["routed to intake English", s.routing.list === "intake.en", s.routing.list],
      ["senior-management reason recorded", s.routing.reasons.some((r) => /walter|senior/i.test(r)), s.routing.reasons.join(" | ")],
      ["briefing adds the by-name ask", /asked for Walter by name/i.test(s.briefing), s.briefing],
      ["no doubled period after reason", !/\.\./.test(s.briefing), s.briefing],
    ],
  },
  {
    name: "after-hours call (Sunday 02:00 PT) goes to the overnight slot",
    call: {
      call_id: "c_night", start_timestamp: Date.UTC(2026, 8, 20, 9, 0), end_timestamp: Date.UTC(2026, 8, 20, 9, 1), duration_ms: 60000, from_number: "+14155550444", disconnection_reason: "call_transfer", call_status: "ended",
      call_analysis: { custom_analysis_data: { caller_type: "new_client", language: "en", caller_full_name: "Night Caller", callback_phone: "CALLER_ID", reason: "unpaid wages", asked_for_senior_management: false, requested_person: "", message_taken: false, legal_information_given: false } },
      transcript_object: [], transcript_with_tool_calls: tools("transfer_to_intake", "Transfer bridged", true),
    },
    expect: (s) => [
      ["flagged outside business hours", s.routing.businessHours === false, String(s.routing.businessHours)],
      ["after-hours callback wording from config", s.routing.callbackWindow === cfg.callbackWindow.afterHours.en, s.routing.callbackWindow],
    ],
  },
];

const summaries = [];
for (const c of cases) {
  console.log(`\n${c.name}`);
  let s;
  try { s = summarize(c.call, cfg); } catch (e) { check("summarize does not throw", false, e.message); continue; }
  summaries.push(s);
  for (const [name, cond, detail] of c.expect(s)) check(name, Boolean(cond), detail);
  check("serializes to JSON", (() => { try { JSON.stringify(s); return true; } catch { return false; } })());
}

// Render the page from these summaries, without clobbering a real calls.json / index.html.
console.log("\npage render");
const callsPath = join(here, "calls.json");
const pagePath = join(here, "index.html");
const backups = [];
for (const f of [callsPath, pagePath]) if (existsSync(f)) { renameSync(f, f + ".bak"); backups.push(f); }
try {
  writeFileSync(callsPath, JSON.stringify({ generated_at: new Date().toISOString(), sample: true, names: { agent: "Maya", intake: "James", admin: "Ana" }, staff: { intake: cfg.staff.intake, admin: cfg.staff.admin }, calls: summaries }, null, 2));
  execFileSync(process.execPath, [join(here, "build-page.mjs")], { stdio: "pipe" });
  const html = readFileSync(pagePath, "utf8");
  check("index.html rendered", html.length > 1000, `${html.length} bytes`);
  check("every case appears on the page", summaries.every((s) => html.includes(s.call_id)));
  check("no raw undefined on the page", !/>\s*undefined\s*</.test(html));
  check("no unfilled placeholders on the page", !/\{\{\w+\}\}/.test(html));
} catch (e) {
  check("build-page.mjs runs", false, e.message);
} finally {
  for (const f of [callsPath, pagePath]) if (existsSync(f)) unlinkSync(f);
  for (const f of backups) renameSync(f + ".bak", f);
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
