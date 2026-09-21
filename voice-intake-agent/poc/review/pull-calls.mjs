#!/usr/bin/env node
// Pulls recent calls for the POC agent from Retell, computes the routing decision, the briefing,
// and the Salesforce preview for each, and writes poc/review/calls.json.
//
// Env: RETELL_API_KEY (required), INTAKE_PHONE, ADMIN_PHONE (required), INTAKE_NAME, ADMIN_NAME,
//      AGENT_NAME, RETELL_AGENT_ID (else read from ../agent/.retell-ids.json), SINCE_HOURS (default 72),
//      RETELL_BASE_URL.
// Usage: node poc/review/pull-calls.mjs            fetch and write calls.json
//        node poc/review/pull-calls.mjs --sample   write two example calls instead (no API key needed)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decideRouting, demoConfig } from "./routing.mjs";
import { buildSalesforcePreview, toE164 } from "./salesforce-preview.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const OUT = join(here, "calls.json");

const names = {
  agent: process.env.AGENT_NAME || "Maya",
  intake: process.env.INTAKE_NAME || "James",
  admin: process.env.ADMIN_NAME || "Ana",
};

function loadConfig() {
  const base = JSON.parse(readFileSync(join(root, "config", "routing.example.json"), "utf8"));
  return demoConfig(base, {
    intakeName: names.intake, intakePhone: process.env.INTAKE_PHONE || "+14155550101",
    adminName: names.admin, adminPhone: process.env.ADMIN_PHONE || "+14155550201",
  });
}

/** Pull the blockquote text of a named section out of prompts/briefing.md. */
function briefingTemplate(sectionPrefix) {
  const md = readFileSync(join(root, "prompts", "briefing.md"), "utf8");
  const sections = md.split(/\n## /).slice(1);
  const sec = sections.find((s) => s.toLowerCase().startsWith(sectionPrefix.toLowerCase()));
  if (!sec) return "";
  return sec.split("\n").filter((l) => l.startsWith("> ")).map((l) => l.slice(2)).join(" ").trim();
}

function spokenPhone(e164) {
  if (!e164) return "not captured";
  const d = e164.replace(/\D/g, "").replace(/^1/, "");
  if (d.length !== 10) return e164;
  const words = { 0: "oh", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine" };
  const g = (s) => [...s].map((c) => words[c]).join(" ");
  return `${g(d.slice(0, 3))}, ${g(d.slice(3, 6))}, ${g(d.slice(6))}`;
}

export function renderBriefing(analysis, routing, phone) {
  const callerType = analysis.caller_type || "unknown";
  const section = callerType === "existing_client" ? "Admin transfer (existing client)"
    : callerType === "other" ? "Admin transfer (other matter)"
    : "Intake transfer, English";
  let text = briefingTemplate(section);
  const vars = {
    slot_name: routing.target?.name || "(nobody)",
    agent_name: names.agent,
    caller_name: analysis.caller_full_name || "an unnamed caller",
    caller_type_spoken: callerType === "existing_client" ? "an existing client" : callerType === "other" ? "not a client" : "a new client",
    language_spoken: analysis.language === "es" ? "Spanish" : "English",
    reason: (analysis.reason || "").replace(/[.。]\s*$/, ""),
    callback_phone_spoken: phone ? spokenPhone(phone) : "No callback number captured",
    caller_organization: analysis.caller_organization || "an outside organization",
    requested_person: analysis.requested_person || "",
  };
  text = text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  if (!analysis.reason) text = text.replace(/\s*(They're|Llama por|They are) calling about: \.\s*/i, " ");
  if (analysis.asked_for_senior_management) {
    text += ` They asked for ${analysis.requested_person || "senior management"} by name.`;
  }
  return text;
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function agentId() {
  if (process.env.RETELL_AGENT_ID) return process.env.RETELL_AGENT_ID;
  const f = join(here, "..", "agent", ".retell-ids.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).agent_id;
  console.error("No agent id. Run create-agent.mjs first or set RETELL_AGENT_ID.");
  process.exit(2);
}

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
  const sf = buildSalesforcePreview(call, analysis, routing);
  const transcript = (call.transcript_object || []).map((u) => ({ role: u.role, content: u.content }));
  const whisperHeard = (call.transcript_with_tool_calls || [])
    .filter((u) => u.role === "transfer_target" || (u.role === "agent" && /this is .*intake assistant/i.test(u.content || "")))
    .map((u) => ({ role: u.role, content: u.content }));
  return {
    call_id: call.call_id,
    started_at: new Date(at).toISOString(),
    duration_s: Math.round((call.duration_ms || 0) / 1000),
    from_number: call.from_number || "",
    disconnection_reason: call.disconnection_reason || "",
    analysis,
    summary: call.call_analysis?.call_summary || "",
    transcript,
    whisperHeard,
    routing: { list: routing.list, target: routing.target ? { name: routing.target.name, number: routing.target.number } : null, reasons: routing.reasons, businessHours: routing.businessHours, callbackWindow: routing.callbackWindow },
    briefing: renderBriefing(analysis, routing, sf.phone),
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
  const disclosure = `Hi, I'm ${names.agent}, the virtual assistant for the firm. This call is transcribed for our records, but not recorded. I'll take a few quick details and connect you with the right person. Are you a new client, or do you already have a case with us?`;
  return [
    mk("call_example_1", 30, "+14155551234",
      { disclosure_given: true, caller_type: "new_client", language: "en", caller_full_name: "Dana Whitfield", callback_phone: "CALLER_ID", reason: "I was let go last week after I reported my manager for not paying overtime.", asked_for_senior_management: false, requested_person: "", message_taken: false, legal_information_given: false },
      "call_transfer",
      [
        { role: "agent", content: "Thank you for calling the firm. Gracias por llamar a the firm." },
        { role: "user", content: "Hi, yes, English please. I think I need a lawyer." },
        { role: "agent", content: disclosure },
        { role: "user", content: "New. I've never called before." },
        { role: "agent", content: "May I have your full name?" },
        { role: "user", content: "Dana Whitfield." },
        { role: "agent", content: "Thank you, Dana. Is the number you're calling from the best one to reach you?" },
        { role: "user", content: "Yes." },
        { role: "agent", content: "And in one sentence, what's this regarding?" },
        { role: "user", content: "I was let go last week after I reported my manager for not paying overtime. Do I have a case?" },
        { role: "agent", content: "That's exactly what the intake manager will go over with you. Let me get you to them. Please hold for a moment while I connect you with James. This may take a minute." },
      ],
      [{ role: "tool_call_invocation", name: "transfer_to_intake", arguments: "{}", tool_call_id: "t1" }, { role: "tool_call_result", content: "Transfer bridged", tool_call_id: "t1", successful: true }]),
    mk("call_example_2", 12, "+16505550199",
      { disclosure_given: true, caller_type: "existing_client", language: "es", caller_full_name: "Carlos Mendoza", callback_phone: "+16505550199", reason: "Quiero saber cómo va mi caso.", asked_for_senior_management: true, requested_person: "Walter", message_taken: true, legal_information_given: false },
      "agent_hangup",
      [
        { role: "agent", content: "Thank you for calling the firm. Gracias por llamar a the firm." },
        { role: "user", content: "Hola, buenas. ¿Me puede comunicar con Walter?" },
        { role: "agent", content: `Hola, soy ${names.agent}, la asistente virtual de la firma. Esta llamada se transcribe para nuestros registros, pero no se graba. Le comunicaré con el equipo de admisión, y ellos se aseguran de que Walter reciba el mensaje. ¿Me da su nombre completo?` },
        { role: "user", content: "Carlos Mendoza. Ya tengo un caso con ustedes." },
        { role: "agent", content: "Gracias, Carlos. ¿El número desde el que llama es el mejor para contactarlo?" },
        { role: "user", content: "Sí." },
        { role: "agent", content: "¿Y brevemente, en qué podemos ayudarle hoy?" },
        { role: "user", content: "Quiero saber cómo va mi caso." },
        { role: "agent", content: "Por favor espere un momento mientras le comunico con James. Puede tardar un minuto." },
        { role: "agent", content: "Lo siento, todos están atendiendo a otros clientes en este momento. Tengo sus datos, y alguien le devolverá la llamada dentro de una hora hábil. ¿Hay algo más que quiera que le transmita?" },
        { role: "user", content: "No, gracias." },
        { role: "agent", content: "Gracias por llamar. Hasta luego." },
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
    if (!process.env.RETELL_API_KEY) { console.error("Missing RETELL_API_KEY (or pass --sample)"); process.exit(2); }
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
    const res = await api("POST", "/v3/list-calls", body);
    calls = Array.isArray(res) ? res : res?.calls ?? res?.data ?? [];
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

main().catch((err) => { console.error(err.message || err); process.exit(1); });
