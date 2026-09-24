#!/usr/bin/env node
// Pulls recent calls for the POC agent from Retell, computes the routing decision, the briefing,
// and the Salesforce preview for each, and writes poc/review/calls.json.
//
// Names come from ../agent/live.json, the same file create-agent.mjs uses.
// Env: RETELL_API_KEY (or an API credential on the environment), INTAKE_PHONE, ADMIN_PHONE (shown on
//      the page; placeholders if unset), RETELL_AGENT_ID (else read from ../agent/.retell-ids.json),
//      SINCE_HOURS (default 72), RETELL_BASE_URL.
// Usage: node poc/review/pull-calls.mjs            fetch and write calls.json
//        node poc/review/pull-calls.mjs --sample   write two example calls instead (no API key needed)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideRouting, demoConfig } from "./routing.mjs";
import { buildSalesforcePreview, transferAttempts } from "./salesforce-preview.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const OUT = join(here, "calls.json");

const live = JSON.parse(readFileSync(join(here, "..", "agent", "live.json"), "utf8"));
const names = { agent: live.agent_name, intake: live.intake_name, admin: live.admin_name, firm: live.firm_name };

function loadConfig() {
  const base = JSON.parse(readFileSync(join(root, "config", "routing.example.json"), "utf8"));
  return demoConfig(base, {
    intakeName: names.intake, intakePhone: process.env.INTAKE_PHONE || "+14155550101",
    adminName: names.admin, adminPhone: process.env.ADMIN_PHONE || "+14155550201",
  });
}

/**
 * What was actually said on the private staff line: Maya's and the staff member's lines between the
 * last transfer invocation and its result. The briefing is Maya's part of it.
 */
export function handoffExchange(call) {
  const log = call.transcript_with_tool_calls || [];
  let start = -1;
  for (let i = 0; i < log.length; i++) if (log[i].role === "tool_call_invocation" && /^transfer_/.test(log[i].name || "")) start = i;
  if (start < 0) return { attempted: false, lines: [], briefing: "No transfer attempted." };
  const id = log[start].tool_call_id;
  let end = log.findIndex((u, i) => i > start && u.role === "tool_call_result" && u.tool_call_id === id);
  if (end < 0) end = log.length;
  const lines = log.slice(start + 1, end)
    .filter((u) => (u.role === "agent" || u.role === "transfer_target") && String(u.content || "").trim())
    .map((u) => ({ role: u.role === "agent" ? "maya" : "staff", content: String(u.content).trim() }));
  const briefing = lines.filter((l) => l.role === "maya").map((l) => l.content).join(" ");
  return { attempted: true, lines, briefing: briefing || "Transfer attempted, but no briefing was spoken (nobody picked up, or the caller hung up first)." };
}

/**
 * Was the transcript notice given before the first name or number question? Computed from the
 * transcript, not the model's post-call analysis.
 * @returns {"given"|"missing"|"not_needed"}
 */
export function disclosureStatus(transcript) {
  const agent = (transcript || []).map((u, i) => ({ ...u, i })).filter((u) => u.role === "agent");
  const ask = agent.find((u) => /\b(name|number|nombre|n[uú]mero)\b[^?]*\?/i.test(u.content || ""));
  const notice = agent.find((u) => /transcript|transcripci[oó]n/i.test(u.content || ""));
  if (!ask) return notice ? "given" : "not_needed";
  return notice && notice.i <= ask.i ? "given" : "missing";
}

async function api(method, path, body) {
  // Retry rate limits and server errors a few times; anything else fails at once.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + path, {
      method, headers: { ...(process.env.RETELL_API_KEY ? { Authorization: `Bearer ${process.env.RETELL_API_KEY}` } : {}), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); continue; }
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text}`);
  }
}

function agentId() {
  if (process.env.RETELL_AGENT_ID) return process.env.RETELL_AGENT_ID;
  const f = join(here, "..", "agent", ".retell-ids.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).agent_id;
  console.error("No agent id. Run create-agent.mjs first or set RETELL_AGENT_ID.");
  process.exit(2);
}

export { loadConfig };

export function summarize(call, cfg) {
  const analysis = call.call_analysis?.custom_analysis_data || {};
  const at = call.start_timestamp || Date.now();
  const routing = decideRouting({
    language: analysis.language || "unknown",
    callerType: analysis.caller_type || "unknown",
    askedForSeniorManagement: analysis.asked_for_senior_management === true,
    requestedPerson: analysis.requested_person || "",
    at,
  }, cfg);
  // The rules above say who should get the call; Maya's tool call says who actually did. Owners
  // and Tasks follow what actually happened.
  const attempts = transferAttempts(call);
  const lastTool = attempts.length ? attempts[attempts.length - 1].tool : null;
  const toolStaff = { transfer_to_intake: { id: "intake", ...cfg.staff.intake }, transfer_to_admin: { id: "admin", ...cfg.staff.admin } }[lastTool] || null;
  const used = toolStaff ? { ...routing, target: toolStaff } : routing;
  if (toolStaff && routing.target?.id !== toolStaff.id) routing.reasons.push(`${names.agent} actually used ${lastTool} (${toolStaff.name}); the rules would pick ${routing.target?.name || "no transfer"}.`);
  const sf = buildSalesforcePreview(call, analysis, used);
  const transcript = (call.transcript_object || []).map((u) => ({ role: u.role, content: u.content }));
  const handoff = handoffExchange(call);
  return {
    call_id: call.call_id,
    started_at: new Date(at).toISOString(),
    duration_s: Math.round((call.duration_ms || 0) / 1000),
    from_number: call.from_number || "",
    disconnection_reason: call.disconnection_reason || "",
    analysis,
    summary: call.call_analysis?.call_summary || "",
    transcript,
    disclosure: disclosureStatus(transcript),
    handoff: handoff.lines,
    routing: { list: routing.list, target: routing.target ? { name: routing.target.name, number: routing.target.number } : null, used: toolStaff ? { tool: lastTool, name: toolStaff.name } : null, reasons: routing.reasons, businessHours: routing.businessHours, callbackWindow: routing.callbackWindow },
    briefing: handoff.briefing,
    salesforce: { disposition: sf.disposition.label, dispositionKey: sf.disposition.key, attempts: sf.disposition.attempts, lead: sf.lead, note: sf.note, task: sf.task, contactTask: sf.contactTask, explanation: sf.explanation },
  };
}

function sampleCalls(cfg) {
  const t0 = Date.UTC(2026, 8, 22, 17, 12);
  const mk = (id, minutesAgo, from, analysis, reason, transcript, tools) => ({
    call_id: id, start_timestamp: t0 - minutesAgo * 60000, duration_ms: 82000, from_number: from,
    disconnection_reason: reason,
    call_analysis: { custom_analysis_data: analysis, call_summary: "" },
    transcript: transcript.map((t) => `${t.role === "agent" ? "Agent" : "User"}: ${t.content}`).join("\n"),
    transcript_object: transcript,
    transcript_with_tool_calls: [...transcript, ...tools],
  });
  const greeting = `Thanks for calling ${names.firm}, this is ${names.agent}, the firm's virtual assistant. Are you calling about a new matter, or do you already have a case with us?`;
  return [
    mk("call_example_1", 30, "+14155551234",
      { disclosure_given: true, caller_type: "new_client", language: "en", caller_full_name: "Dana Whitfield", callback_phone: "CALLER_ID", reason: "I was let go last week after I reported my manager.", asked_for_senior_management: false, requested_person: "", message_taken: false, legal_information_given: false, caller_mood: "calm", upset_about: "" },
      "call_transfer",
      [
        { role: "agent", content: greeting },
        { role: "user", content: "New. I was let go last week after I reported my manager. Do I have a case?" },
        { role: "agent", content: "That's exactly what our team will go over with you. Let me get you to them. Just so you know, we keep a transcript of the call, but it's not recorded. Can I get your full name?" },
        { role: "user", content: "Dana Whitfield." },
        { role: "agent", content: "Thanks, Dana. Could you spell your last name for me?" },
        { role: "user", content: "W-H-I-T-F-I-E-L-D." },
        { role: "agent", content: "W, H, I, T, F, I, E, L, D. Is that right?" },
        { role: "user", content: "Yes." },
        { role: "agent", content: "Is the number you're calling from the best one to reach you?" },
        { role: "user", content: "Yes." },
        { role: "agent", content: `Okay, let me get you over to ${names.intake}, one moment.` },
      ],
      [
        { role: "tool_call_invocation", name: "transfer_to_intake", arguments: "{}", tool_call_id: "t1" },
        { role: "transfer_target", content: "Hello?" },
        { role: "agent", content: `Hi ${names.intake}, ${names.agent} here. I've got Dana Whitfield, a new client. Callback is the number they're calling from, four one five, five five five, one two three four. They mentioned "let go last week after I reported my manager." Stay on to take it, or hang up and I'll take a message.` },
        { role: "transfer_target", content: "Okay, put her through." },
        { role: "tool_call_result", content: "{\"status\":\"transferred successfully\"}", tool_call_id: "t1", successful: true },
      ]),
    mk("call_example_2", 12, "+16505550199",
      { disclosure_given: true, caller_type: "new_client", language: "es", caller_full_name: "Carlos Mendoza", callback_phone: "+16505550199", reason: "", asked_for_senior_management: true, requested_person: "Walter", message_taken: true, legal_information_given: false, caller_mood: "calm", upset_about: "" },
      "agent_hangup",
      [
        { role: "agent", content: greeting },
        { role: "user", content: "Hola, buenas. ¿Me puede comunicar con Walter, por favor?" },
        { role: "agent", content: "Le comunicaré con el equipo de admisión, y ellos se asegurarán de que Walter reciba el mensaje. ¿Ya tiene un caso con nosotros?" },
        { role: "user", content: "No, es la primera vez." },
        { role: "agent", content: "Claro. Solo para que sepa, guardamos una transcripción de la llamada, pero no se graba. ¿Me da su nombre completo?" },
        { role: "user", content: "Carlos Mendoza." },
        { role: "agent", content: "Gracias, Carlos. ¿El número desde el que llama es el mejor para contactarlo?" },
        { role: "user", content: "Sí." },
        { role: "agent", content: `Muy bien, le comunico con ${names.intake}, un momento.` },
        { role: "agent", content: `Lo siento, no pude comunicarme con ${names.intake} en este momento. Tengo su nombre y número, y le devolverán la llamada dentro de la hora. ¿Hay algo más que quiera que le transmita?` },
        { role: "user", content: "No, gracias." },
        { role: "agent", content: `Gracias por llamar a ${names.firm}. Hasta luego.` },
      ],
      [{ role: "tool_call_invocation", name: "transfer_to_intake", arguments: "{}", tool_call_id: "t2" }, { role: "tool_call_result", content: "Transfer failed: no answer", tool_call_id: "t2", successful: false }]),
  ];
}

async function main() {
  const cfg = loadConfig();
  let calls;
  let sample = false;
  if (process.argv.includes("--sample")) {
    calls = sampleCalls(cfg);
    sample = true;
  } else {
    const id = agentId();
    const sinceHours = Number(process.env.SINCE_HOURS || 72);
    const now = Date.now();
    const body = {
      filter_criteria: {
        agent: [{ agent_id: id }],
        start_timestamp: { type: "range", op: "bt", value: [now - sinceHours * 3600000, now] },
      },
      sort_order: "descending",
      limit: 50,
    };
    calls = [];
    for (let page = 0; page < 20; page++) {
      const res = await api("POST", "/v3/list-calls", body);
      const items = Array.isArray(res) ? res : res?.items ?? res?.calls ?? res?.data ?? [];
      calls.push(...items);
      const next = res?.pagination_key ?? res?.next_pagination_key;
      if (items.length < body.limit || !next) break;
      body.pagination_key = next;
    }
    // The list endpoint may omit heavy fields; fetch each call in full.
    calls = await Promise.all(calls.map((c) => api("GET", `/v2/get-call/${c.call_id}`).catch(() => c)));
    calls = calls.filter((c) => c.call_status === "ended" || c.end_timestamp);
  }
  const out = {
    generated_at: new Date().toISOString(),
    sample,
    names,
    staff: { intake: cfg.staff.intake, admin: cfg.staff.admin },
    calls: calls.map((c) => summarize(c, cfg)),
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`${sample ? "Sample: " : ""}wrote ${out.calls.length} call(s) to ${OUT}`);
  for (const c of out.calls) console.log(`  ${c.started_at}  ${c.analysis.caller_type || "?"}/${c.analysis.language || "?"}  -> ${c.routing.target?.name || "no transfer"}  [${c.salesforce.disposition}]`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => { console.error(err.message || err); process.exit(1); });
}
