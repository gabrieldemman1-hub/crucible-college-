#!/usr/bin/env node
// Creates or updates the proof-of-concept Maya agent on Retell AI and binds it to a phone number.
// Plain Node 20+, no dependencies. Safe to re-run: ids are remembered in .retell-ids.json (committed,
// no secrets in it), so every checkout updates the same agent instead of creating a second one.
//
// Names (firm, agent, intake, admin, main office line) come from live.json, which is committed and is
// the single source of truth. Environment variables with the same names are ignored, with a warning
// if they differ, so a stale shell cannot quietly rename the firm.
//
// Env:  RETELL_API_KEY unless the environment attaches the key as an API credential for
//       api.retellai.com (then leave it unset).
//       INTAKE_PHONE, ADMIN_PHONE: optional when the agent already exists; if unset, the numbers
//       on the live agent's transfer tools are kept. Required for a first create.
//       RETELL_PHONE_NUMBER (bind target; if unset, the number in .retell-ids.json, else the only
//       number on the account), VOICE_ID (else agent.config.json's voice_id_default),
//       RETELL_MODEL (default from agent.config.json), RETELL_BASE_URL,
//       VERSION_NOTE (short title for the published version, shown in Retell's version list),
//       TRANSFER_MODE ("warm" default: whisper to staff; "cold": plain transfer, Maya tells the
//       caller what she is passing along instead. Use if the plan lacks warm transfer.)
//
// Usage:  node poc/agent/create-agent.mjs            create or update, publish, bind
//         node poc/agent/create-agent.mjs --voices   just list candidate voices and exit
//         node poc/agent/create-agent.mjs --unbind   detach the agent from the phone number
//         node poc/agent/create-agent.mjs --dry-run  build and print the payloads, call nothing
//                                                    (no key or network needed; phones fall back
//                                                    to placeholders if unset)
//         --new                                      allow creating a new agent even though the
//                                                    phone number is bound to another agent

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const KEY = process.env.RETELL_API_KEY;
const IDS_FILE = join(here, ".retell-ids.json");
const LIVE_FILE = join(here, "live.json");
// Retell fills these at call time. Anything else still in double braces after fill() is a bug.
const RUNTIME_VARS = [/^user_number$/, /^current_time_/,
  // Saved by save_caller_details during the call, read by the staff-side transfer agent.
  /^(caller_name|caller_role|callback|language_note|heads_up|upset_details|their_words|asked_for|call_notes)$/];

function env(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    console.error(`Missing required environment variable ${name}`);
    process.exit(2);
  }
  return v;
}
const DRY = process.argv.includes("--dry-run");

const E164 = /^\+[1-9]\d{7,14}$/;
function checkE164(name, v) {
  if (!E164.test(v)) {
    console.error(`${name} must be in E.164 format like +14155550101, got "${v}"`);
    process.exit(2);
  }
  return v;
}

function leftoverPlaceholders(obj) {
  return [...new Set([...JSON.stringify(obj).matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]))]
    .filter((k) => !RUNTIME_VARS.some((re) => re.test(k)));
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    // No RETELL_API_KEY: rely on an API credential attached by the environment's proxy.
    headers: { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`));
}

function loadIds() {
  return existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, "utf8")) : {};
}
function saveIds(ids) {
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + "\n");
}

async function pickVoice(explicit) {
  if (explicit) return explicit;
  const voices = await api("GET", "/list-voices");
  const list = Array.isArray(voices) ? voices : voices?.items ?? voices?.voices ?? [];
  const candidates = list.filter((v) =>
    String(v.provider || "").toLowerCase().includes("eleven") &&
    String(v.gender || "").toLowerCase() === "female"
  );
  if (!candidates.length) {
    console.error("No ElevenLabs female voice found in /list-voices. Set VOICE_ID explicitly. First voices returned:");
    console.error(list.slice(0, 10).map((v) => `  ${v.voice_id}  ${v.voice_name}  ${v.provider}  ${v.gender}  ${v.accent || ""}`).join("\n"));
    process.exit(2);
  }
  console.log("Candidate voices (set VOICE_ID to choose a different one):");
  for (const v of candidates.slice(0, 12)) {
    console.log(`  ${v.voice_id.padEnd(28)} ${String(v.voice_name).padEnd(14)} ${v.accent || ""} ${v.age || ""}  ${v.preview_audio_url || ""}`);
  }
  return candidates[0].voice_id;
}

function buildAgentBody(a, vars, llmId, voiceId) {
  return {
    agent_name: a.agent_name,
    response_engine: { type: "retell-llm", llm_id: llmId },
    voice_id: voiceId,
    voice_model: a.voice_model,
    voice_temperature: a.voice_temperature,
    voice_speed: a.voice_speed,
    language: a.language,
    responsiveness: a.responsiveness,
    interruption_sensitivity: a.interruption_sensitivity,
    denoising_mode: a.denoising_mode,
    stt_mode: a.stt_mode,
    enable_backchannel: a.enable_backchannel,
    backchannel_frequency: a.backchannel_frequency,
    backchannel_words: a.backchannel_words,
    normalize_for_speech: a.normalize_for_speech,
    begin_message_delay_ms: a.begin_message_delay_ms,
    end_call_after_silence_ms: a.end_call_after_silence_ms,
    reminder_trigger_ms: a.reminder_trigger_ms,
    reminder_max_count: a.reminder_max_count,
    max_call_duration_ms: a.max_call_duration_ms,
    data_storage_setting: a.data_storage_setting,
    opt_in_signed_url: a.opt_in_signed_url,
    boosted_keywords: [...a.boosted_keywords_base, vars.firm_name, vars.intake_name, vars.admin_name],
    post_call_analysis_data: a.post_call_analysis_data,
    // Callback alerts: set ALERT_WEBHOOK_URL to the deployed poc/alerts script. Left out when unset,
    // so a run without it keeps whatever the live agent already has.
    ...(process.env.ALERT_WEBHOOK_URL ? { webhook_url: process.env.ALERT_WEBHOOK_URL, webhook_events: ["call_analyzed"] } : {}),
  };
}

function buildTransferAgentBody(a, name, llmId, voiceId) {
  return {
    agent_name: name,
    response_engine: { type: "retell-llm", llm_id: llmId },
    voice_id: voiceId,
    voice_model: a.voice_model,
    voice_temperature: a.voice_temperature,
    voice_speed: a.voice_speed,
    language: "en-US",
    responsiveness: a.responsiveness,
    interruption_sensitivity: a.interruption_sensitivity,
    denoising_mode: a.denoising_mode,
    stt_mode: a.stt_mode,
    enable_backchannel: false,
    normalize_for_speech: a.normalize_for_speech,
    data_storage_setting: a.data_storage_setting,
    opt_in_signed_url: a.opt_in_signed_url,
    max_call_duration_ms: 300000,
  };
}

/**
 * Update (or create) an LLM + agent pair and publish it. Published versions are immutable, so a
 * published agent gets a new draft version first; Retell gives the LLM a matching draft version.
 * @returns {{ llm_id: string, agent_id: string, version: number }}
 */
async function upsertAndPublish({ llmId, agentId, llmBody, agentBody, createLlmExtra = {}, label, note }) {
  let llmVersion;
  if (agentId) {
    const cur = await api("GET", `/get-agent/${agentId}`);
    if (cur.is_published) {
      const draft = await api("POST", `/create-agent-version/${agentId}`, { base_version: cur.version });
      llmVersion = draft.response_engine?.version;
      console.log(`${label}: opened draft agent version ${draft.version} (LLM version ${llmVersion})`);
    } else {
      llmVersion = cur.response_engine?.version;
    }
  }
  if (llmId) {
    await api("PATCH", `/update-retell-llm/${llmId}${llmVersion !== undefined ? `?version=${llmVersion}` : ""}`, llmBody);
    console.log(`${label}: updated LLM ${llmId}${llmVersion !== undefined ? ` version ${llmVersion}` : ""}`);
  } else {
    llmId = (await api("POST", "/create-retell-llm", { ...llmBody, ...createLlmExtra })).llm_id;
    console.log(`${label}: created LLM ${llmId}`);
  }
  agentBody.response_engine = { type: "retell-llm", llm_id: llmId, ...(llmVersion !== undefined ? { version: llmVersion } : {}) };
  let agent;
  if (agentId) {
    agent = await api("PATCH", `/update-agent/${agentId}`, agentBody);
  } else {
    agent = await api("POST", "/create-agent", agentBody);
    agentId = agent.agent_id;
    console.log(`${label}: created agent ${agentId}`);
  }
  const version = agent.version ?? 0;
  await api("POST", `/publish-agent-version/${agentId}`, { version, version_title: (note || "POC publish").slice(0, 100) });
  console.log(`${label}: published agent version ${version}`);
  return { llm_id: llmId, agent_id: agentId, version };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!KEY && !DRY) console.log("RETELL_API_KEY not set; relying on an API credential configured on the environment for api.retellai.com.");

  if (args.has("--voices")) {
    await pickVoice(undefined);
    return;
  }

  const ids = loadIds();
  if (args.has("--unbind")) {
    if (!ids.phone_number) { console.log("No bound phone number recorded."); return; }
    await api("PATCH", `/update-phone-number/${encodeURIComponent(ids.phone_number)}`, { inbound_agents: null });
    console.log(`Unbound ${ids.phone_number}. Callers will no longer reach the agent.`);
    return;
  }

  const cfg = JSON.parse(readFileSync(join(here, "agent.config.json"), "utf8"));
  const live = JSON.parse(readFileSync(LIVE_FILE, "utf8"));
  const vars = {};
  for (const [key, envName] of [["firm_name", "FIRM_NAME"], ["agent_name", "AGENT_NAME"], ["intake_name", "INTAKE_NAME"], ["admin_name", "ADMIN_NAME"], ["main_office_number", "MAIN_OFFICE_NUMBER"]]) {
    if (!live[key]) { console.error(`live.json is missing "${key}"`); process.exit(2); }
    vars[key] = live[key];
    const e = process.env[envName];
    if (e && e !== live[key]) console.warn(`warn: ${envName}="${e}" in the environment differs from live.json ("${live[key]}"). Using live.json; edit it to change the name.`);
  }

  // Phones: env if set, else whatever the live agent transfers to today. Never an invented default.
  let intakePhone = process.env.INTAKE_PHONE;
  let adminPhone = process.env.ADMIN_PHONE;
  if ((!intakePhone || !adminPhone) && ids.llm_id && !DRY) {
    const cur = await api("GET", `/get-retell-llm/${ids.llm_id}`);
    const numberOf = (name) => (cur.general_tools || []).find((t) => t.name === name)?.transfer_destination?.number;
    intakePhone ||= numberOf("transfer_to_intake");
    adminPhone ||= numberOf("transfer_to_admin");
    console.log(`Transfer numbers kept from the live agent where not set in env: intake ${intakePhone}, admin ${adminPhone}.`);
  }
  if (DRY) { intakePhone ||= "+14155550101"; adminPhone ||= "+14155550201"; }
  if (!intakePhone || !adminPhone) { console.error("Set INTAKE_PHONE and ADMIN_PHONE (no live agent to read them from)."); process.exit(2); }
  checkE164("INTAKE_PHONE", intakePhone);
  checkE164("ADMIN_PHONE", adminPhone);

  const prompt = fill(readFileSync(join(here, "prompt.md"), "utf8"), vars);

  // Staff-side briefing. In agentic mode (default) a separate transfer agent talks to the staff
  // member and only connects the caller on a clear yes. That agent does not see the conversation,
  // only dynamic variables, so Maya saves the caller's details with save_caller_details first.
  // prompts/briefing.md documents the production (multi-person) wording; the POC wording is here.
  const staffName = (dest) => (dest === "intake" ? vars.intake_name : vars.admin_name);
  const hiFor = (dest) => (/^(the|our) /i.test(staffName(dest)) ? `Hi, ${vars.agent_name} here` : `Hi ${staffName(dest)}, ${vars.agent_name} here`);

  const DETAIL_VARS = [
    { name: "caller_name", description: "The caller's full name as they gave it. If they gave none, the words \"a caller who didn't give their name\"." },
    { name: "caller_role", description: "Who the caller is, as a short phrase that follows their name: \"a new client\", \"who says they already have a case\", \"calling about another matter, from <their organization>\", or \"<caller> calling for <person>, who has a case with us\" / \"calling for <person>\". Never \"an existing client or other matter\"." },
    { name: "callback", description: "The callback number, digits in groups of three, three, four (\"949 383 7098\"). If they said the number they're calling from is fine, use the caller ID digits. If there is no number at all, \"none\"." },
    { name: "language_note", description: "Empty if the whole call was in English, or if the caller only said a lone word like \"sí\". \"Speaks Spanish.\" only if they spoke full Spanish sentences. If they spoke any other language at any point, even one sentence, \"Limited English, speaks <that language>.\"" },
    { name: "heads_up", description: "Empty for a calm caller. Otherwise exactly one of: \"Heads up, this caller may be in crisis.\" (hurting themselves, not wanting to be here, danger), \"Heads up, this caller is upset.\", \"Heads up, this caller has been joking around.\", \"Heads up, this caller has been rude.\"" },
    { name: "upset_details", description: "Only if the caller was upset or in crisis: one sentence with what they are upset about in their own words, what they asked for, and what you told them. Otherwise empty." },
    { name: "their_words", description: "If the caller volunteered why they're calling, three to eight of their exact words. Otherwise empty. No legal labels they did not say." },
    { name: "asked_for", description: "Name of any person the caller asked for (Walter, Peg, Anthony, a staff member, their attorney). Otherwise empty." },
    { name: "call_notes", description: "Two to four plain sentences on what happened on the call so far, quoting the caller where you can, so staff questions can be answered. No legal characterization." },
  ];
  const saveDetailsTool = {
    type: "extract_dynamic_variable",
    name: "save_caller_details",
    description: "Save what the staff member needs for their briefing. Call this once, silently, right after you say the hand-off line and immediately before transfer_to_intake or transfer_to_admin. Never say anything about it to the caller.",
    variables: DETAIL_VARS.map((v) => ({ type: "string", ...v })),
  };

  const transferAgentPrompt = (dest) => {
    const who = staffName(dest);
    const told = dest === "intake"
      ? "that an intake manager will get them to the right attorney"
      : "that the admin team will get them to their attorney";
    return [
      `You are ${vars.agent_name}, calling from ${vars.firm_name}'s phone line. You have just reached ${who} on a private line. A caller is on hold with music and cannot hear you. Your job: brief ${who}, answer their questions, and connect the caller only when ${who} clearly says yes.`,
      ``,
      `What you know about the caller (saved before the transfer; a value that is empty, "none", or still in curly braces means you don't have it):`,
      `- Name: {{caller_name}}`,
      `- Who they are: {{caller_role}}`,
      `- Callback: {{callback}} (caller ID: {{user_number}})`,
      `- Language: {{language_note}}`,
      `- Heads-up: {{heads_up}}`,
      `- Upset details: {{upset_details}}`,
      `- Their words: {{their_words}}`,
      `- Asked for: {{asked_for}}`,
      `- Notes: {{call_notes}}`,
      ``,
      `FIRST, wait for the other side to speak, then decide who answered. Say nothing about the caller (no name, number, or anything they said) until a live person has spoken to you and it is clearly not a recording. If you hear a voicemail greeting ("you've reached...", "leave a message", a beep), a "state your name" call-screening message, a phone menu, or any recording, do not brief and do not leave a message: call cancel_transfer at once.`,
      ``,
      `THEN the briefing, quickly, in one breath (under 8 seconds for a calm caller): "${hiFor(dest)}. [Heads-up, if any, first.] I've got [name], [who they are]. [Language, if any.] [If upset: the upset details in one sentence, e.g. what they asked for and ${told}.] [If they asked for someone: 'They asked for <name> by name.'] [If their words: 'They mentioned <their words>.'] Callback [digits, or 'is the number they're calling from' with the digits, or 'No callback number captured']. Can you take them?"`,
      `If you have no saved details at all, say: "${hiFor(dest)}. I've got a caller for you. Can you take them?"`,
      ``,
      `THEN listen. ${who} may ask questions ("What did they say?", "How angry are they?", "Did they ask for anyone?", "What did you tell them?"). Answer each in one or two sentences from the saved details and notes, quoting the caller's words where you have them. If you don't know, say "They didn't say." Never guess and never characterize the legal matter. After answering, ask again: "Can you take them?"`,
      ``,
      `DECIDE. Only a clear yes connects the caller: "yes", "yeah", "sure", "go ahead", "put them through", "I'll take it", "okay, send them over". When you hear that, call bridge_transfer.`,
      `A no, "I can't right now", "I'm busy", "not now", or "take a message": call cancel_transfer (it says "No problem, I'll take a message." for you).`,
      `Anything unclear (a bare "okay" in the middle of a question, "hold on", "wait", "um", silence): do not connect. Ask once, "Should I put them through?" If it is still not a clear yes, call cancel_transfer.`,
      `Keep it short: the caller is waiting on hold. Never connect the caller without a clear yes.`,
    ].join("\n");
  };

  // Legacy prompt-mode whisper (TRANSFER_MODE=warm): the caller is connected on any non-question.
  const whisperPrompt = (dest) => `${transferAgentPrompt(dest).split("\n\nDECIDE.")[0]}\n\nThe caller is connected as soon as ${staffName(dest)} says anything that is not a question. The only way to decline is to hang up.`;

  const transferMode = env("TRANSFER_MODE", cfg.transfer.mode || "agentic");
  if (!["agentic", "warm", "cold"].includes(transferMode)) { console.error('TRANSFER_MODE must be "agentic", "warm" or "cold"'); process.exit(2); }

  const transferTool = (name, description, number, dest, transferAgents) => ({
    type: "transfer_call",
    name,
    description,
    transfer_destination: { type: "predefined", number },
    transfer_option: transferMode === "agentic" ? {
      type: "agentic_warm_transfer",
      agentic_transfer_config: {
        action_on_timeout: "cancel_transfer",
        transfer_timeout_ms: cfg.transfer.decision_timeout_ms,
        transfer_agent: { agent_id: transferAgents?.[dest]?.agent_id ?? `<transfer agent for ${dest}>`, agent_version: transferAgents?.[dest]?.version ?? 0 },
      },
      transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
      on_hold_music: cfg.transfer.on_hold_music,
      show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
    } : transferMode === "warm" ? {
      type: "warm_transfer",
      agent_detection_timeout_ms: cfg.transfer.agent_detection_timeout_ms,
      transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
      on_hold_music: cfg.transfer.on_hold_music,
      opt_out_human_detection: cfg.transfer.opt_out_human_detection,
      show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
      private_handoff_option: { type: "prompt", prompt: whisperPrompt(dest) },
    } : {
      type: "cold_transfer",
      transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
      show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
    },
    speak_during_execution: true,
    execution_message_type: "prompt",
    execution_message_description: transferMode === "cold"
      ? `In the caller's language, say you are connecting them now and that you will pass along their name and callback number. Two sentences at most. Never use the caller's name. Do not characterize the legal matter.`
      : `In the caller's language. If your previous turn already told the caller you're transferring them, say only "One moment." Never use the caller's name.`,
  });

  const intakeLine = "an intake manager";
  const buildLlmBody = (transferAgents) => ({
    model: process.env[cfg.llm.model_env] || cfg.llm.model_default,
    model_temperature: cfg.llm.model_temperature,
    tool_call_strict_mode: cfg.llm.tool_call_strict_mode,
    general_prompt: prompt,
    begin_message: `Thanks for calling ${vars.firm_name}, this is ${vars.agent_name}. Just so you know, we keep a transcript of this call. Are you calling about a new matter, or do you already have a case with us?`,
    general_tools: [
      { type: "end_call", name: "end_call", description: "End the call only for a reason listed in section 8 of the prompt (wrong number, refused the transcript, failed transfer after the caller answered the last question, message taken, silence after both nudges, or the caller hung up). Say goodbye first unless the caller has hung up." },
      ...(transferMode === "cold" ? [] : [saveDetailsTool]),
      transferTool(
        "transfer_to_intake",
        `Transfer to ${intakeLine}. Use for: new clients and anyone unsure, in any language; anyone who asked for Walter, Peg, or Anthony; any caller who may be in crisis, even an existing client; non-employment matters. Call only after name and number (or the caller refused them), right after the hand-off line${transferMode === "cold" ? "" : " and save_caller_details"}.`,
        intakePhone, "intake", transferAgents
      ),
      transferTool(
        "transfer_to_admin",
        `Transfer to ${vars.admin_name}. Use for: existing clients (they say they already have a case with us), people calling for someone who already has a case, and other matters (vendors, courts, other law firms, sales). Never for a caller who may be in crisis. Call only after name and number (or the caller refused them), right after the hand-off line${transferMode === "cold" ? "" : " and save_caller_details"}.`,
        adminPhone, "admin", transferAgents
      ),
    ],
  });

  const transferLlmBody = (dest) => ({
    model: process.env[cfg.llm.model_env] || cfg.llm.model_default,
    model_temperature: cfg.llm.model_temperature,
    general_prompt: transferAgentPrompt(dest),
    // The staff side speaks first ("Hello?"), so a voicemail greeting or call screener is heard
    // before Maya says anything about the caller.
    start_speaker: "user",
    begin_message: "",
    general_tools: [
      { type: "bridge_transfer", name: "bridge_transfer", description: `Connect the caller to ${staffName(dest)}. Only after a clear yes.`, speak_during_execution: true, execution_message_type: "static_text", execution_message_description: "Great, connecting you now." },
      { type: "cancel_transfer", name: "cancel_transfer", description: "Do not connect the caller: voicemail, call screening, a no, or no clear yes after asking twice. The caller goes back to the main line for a message.", speak_during_execution: true, execution_message_type: "prompt", execution_message_description: "If a live person said no or couldn't take the call, say exactly \"No problem, I'll take a message.\" If it was a voicemail, a recording, or a call-screening system, say nothing at all." },
    ],
  });
  const llmBody = buildLlmBody(null);

  const leftovers = (agentBody) => leftoverPlaceholders({ llmBody, agentBody, transfer: ["intake", "admin"].map(transferLlmBody) });

  if (DRY) {
    const a = cfg.agent;
    const agentBody = buildAgentBody(a, vars, ids.llm_id || "<llm_id from create-retell-llm>", process.env.VOICE_ID || a.voice_id_default);
    const unfilled = leftovers(agentBody);
    const out = {
      dry_run: true,
      would_call: [
        ids.llm_id ? `PATCH /update-retell-llm/${ids.llm_id}` : "POST /create-retell-llm",
          ids.agent_id ? `PATCH /update-agent/${ids.agent_id}` : "POST /create-agent",
        process.env.RETELL_PHONE_NUMBER ? `PATCH /update-phone-number/${process.env.RETELL_PHONE_NUMBER}` : "GET /v2/list-phone-numbers, then PATCH /update-phone-number/<number>",
      ],
      env_used: { ...vars, intake_phone: intakePhone, admin_phone: adminPhone, model: llmBody.model, transfer_mode: transferMode },
      prompt_words: prompt.split(/\s+/).length,
      unfilled_placeholders: unfilled,
      llmBody,
      agentBody,
    };
    console.log(JSON.stringify(out, null, 2));
    if (unfilled.length) { console.error(`\nUnfilled placeholders: ${unfilled.join(", ")}`); process.exit(3); }
    return;
  }

  const voiceId = await pickVoice(process.env.VOICE_ID || cfg.agent.voice_id_default);
  const unfilled = leftovers(buildAgentBody(cfg.agent, vars, "x", voiceId));
  if (unfilled.length) { console.error(`Unfilled placeholders: ${unfilled.join(", ")}. Nothing was changed.`); process.exit(3); }

  // Resolve the phone number before touching anything, so a fresh checkout without ids cannot
  // create a second agent and steal a number that is already answering calls.
  let number = process.env.RETELL_PHONE_NUMBER || ids.phone_number;
  const nums = await api("GET", "/v2/list-phone-numbers");
  const numList = Array.isArray(nums) ? nums : nums?.items ?? nums?.phone_numbers ?? [];
  if (!number) {
    if (numList.length === 1) number = numList[0].phone_number;
    else if (numList.length === 0) { console.log("No phone number on the account yet. Buy one in the Retell dashboard, then re-run with RETELL_PHONE_NUMBER set."); return; }
    else { console.log("Several numbers on the account. Set RETELL_PHONE_NUMBER to one of:\n  " + numList.map((n) => n.phone_number).join("\n  ")); return; }
  }
  const target = numList.find((n) => n.phone_number === number);
  if (!target) { console.error(`${number} is not on this Retell account.`); process.exit(2); }
  const boundTo = (target.inbound_agents || []).map((x) => x.agent_id).concat(target.inbound_agent_id || []).filter(Boolean);
  const others = boundTo.filter((id) => id !== ids.agent_id);
  if (!ids.agent_id && others.length && !args.has("--new")) {
    console.error(`${number} already answers with agent ${others.join(", ")}, and .retell-ids.json has no agent. Restore .retell-ids.json from git to update that agent, or pass --new to create a second one and move the number to it.`);
    process.exit(2);
  }

  const a = cfg.agent;
  const note = process.env.VERSION_NOTE;

  // Staff-side transfer agents first: the main agent's transfer tools point at their published versions.
  let transferAgents = null;
  if (transferMode === "agentic") {
    ids.transfer_agents ||= {};
    transferAgents = {};
    for (const dest of ["intake", "admin"]) {
      const cur = ids.transfer_agents[dest] || {};
      const res = await upsertAndPublish({
        llmId: cur.llm_id, agentId: cur.agent_id,
        llmBody: transferLlmBody(dest),
        agentBody: buildTransferAgentBody(a, `${vars.agent_name} transfer (${dest})`, cur.llm_id, voiceId),
        createLlmExtra: { is_transfer_llm: true },
        label: `Transfer agent (${dest})`, note,
      });
      ids.transfer_agents[dest] = { llm_id: res.llm_id, agent_id: res.agent_id };
      saveIds(ids);
      transferAgents[dest] = { agent_id: res.agent_id, version: res.version };
    }
  }

  const main = await upsertAndPublish({
    llmId: ids.llm_id, agentId: ids.agent_id,
    llmBody: buildLlmBody(transferAgents),
    agentBody: buildAgentBody(a, vars, ids.llm_id, voiceId),
    label: "Maya", note,
  });
  ids.llm_id = main.llm_id;
  ids.agent_id = main.agent_id;
  saveIds(ids);

  // Bind to the phone number.
  await api("PATCH", `/update-phone-number/${encodeURIComponent(number)}`, {
    nickname: `${vars.agent_name} intake POC`,
    inbound_agents: [{ agent_id: ids.agent_id, weight: 1 }],
  });
  ids.phone_number = number;
  saveIds(ids);

  console.log("\nDone.");
  console.log(`  Call ${number} to reach ${vars.agent_name}.`);
  console.log(`  New clients transfer to ${vars.intake_name} at ${intakePhone}.`);
  console.log(`  Existing clients and other matters transfer to ${vars.admin_name} at ${adminPhone}.`);
  console.log(`  Model: ${llmBody.model}. Voice: ${voiceId}. Language: ${a.language}. Transfer mode: ${transferMode}${transferMode === "agentic" ? " (staff must say yes)" : ""}.`);
  if (!process.env.ALERT_WEBHOOK_URL) console.log("  Callback alerts: ALERT_WEBHOOK_URL not set; the live agent's webhook, if any, is unchanged.");
  console.log(`  Ids saved to ${IDS_FILE}. Commit it so every checkout updates this agent.`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
