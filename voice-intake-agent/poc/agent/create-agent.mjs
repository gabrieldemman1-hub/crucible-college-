#!/usr/bin/env node
// Creates or updates the proof-of-concept Maya agent on Retell AI and binds it to a phone number.
// Plain Node 20+, no dependencies. Safe to re-run: ids are remembered in .retell-ids.json (gitignored).
//
// Required env:  INTAKE_PHONE, ADMIN_PHONE. RETELL_API_KEY unless the environment attaches the key
//                as an API credential for api.retellai.com (then leave it unset).
// Optional env:  INTAKE_NAME (default "James"), ADMIN_NAME ("Ana"), FIRM_NAME ("the firm"),
//                AGENT_NAME ("Maya"), MAIN_OFFICE_NUMBER, RETELL_PHONE_NUMBER (bind target; if unset
//                and the account has exactly one number, that one is used), VOICE_ID (else a
//                multilingual ElevenLabs female voice is picked from /list-voices and printed),
//                RETELL_MODEL (default from agent.config.json), RETELL_BASE_URL,
//                TRANSFER_MODE ("warm" default: whisper to staff; "cold": plain transfer, Maya
//                tells the caller what she is passing along instead. Use if the account's plan
//                does not include warm transfer.)
//
// Usage:  node poc/agent/create-agent.mjs            create or update everything
//         node poc/agent/create-agent.mjs --voices   just list candidate voices and exit
//         node poc/agent/create-agent.mjs --unbind   detach the agent from the phone number
//         node poc/agent/create-agent.mjs --dry-run  build and print the payloads, call nothing
//                                                    (no key or network needed; phones default
//                                                    to placeholders if unset)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const KEY = process.env.RETELL_API_KEY;
const IDS_FILE = join(here, ".retell-ids.json");

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

function e164(name, dryFallback) {
  const v = DRY && dryFallback !== undefined ? env(name, dryFallback) : env(name);
  if (!/^\+[1-9]\d{7,14}$/.test(v)) {
    console.error(`${name} must be in E.164 format like +14155550101, got "${v}"`);
    process.exit(2);
  }
  return v;
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
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!KEY && !DRY) console.log("RETELL_API_KEY not set; relying on an API credential configured on the environment for api.retellai.com.");

  if (args.has("--voices")) {
    await pickVoice(undefined);
    return;
  }

  const cfg = JSON.parse(readFileSync(join(here, "agent.config.json"), "utf8"));
  const vars = {
    agent_name: env("AGENT_NAME", "Maya"),
    firm_name: env("FIRM_NAME", "the firm"),
    intake_name: env("INTAKE_NAME", "James"),
    admin_name: env("ADMIN_NAME", "Ana"),
    main_office_number: env("MAIN_OFFICE_NUMBER", "the main office number"),
  };
  const intakePhone = e164("INTAKE_PHONE", "+14155550101");
  const adminPhone = e164("ADMIN_PHONE", "+14155550201");

  if (args.has("--unbind")) {
    const ids = loadIds();
    if (!ids.phone_number) { console.log("No bound phone number recorded."); return; }
    await api("PATCH", `/update-phone-number/${encodeURIComponent(ids.phone_number)}`, { inbound_agents: null });
    console.log(`Unbound ${ids.phone_number}. Callers will no longer reach ${vars.agent_name}.`);
    return;
  }

  const prompt = fill(readFileSync(join(here, "prompt.md"), "utf8"), vars);
  // Pull only the relevant sections of prompts/briefing.md into each whisper prompt. Fill the
  // firm's names, then turn the remaining {{slots}} into [slots]: Retell treats double braces as
  // dynamic variables and would blank them out.
  const briefingMd = readFileSync(join(root, "prompts", "briefing.md"), "utf8");
  const briefingSections = (...prefixes) => briefingMd.split(/\n## /).slice(1)
    .filter((sec) => prefixes.some((p) => sec.toLowerCase().startsWith(p.toLowerCase())))
    .map((sec) => "## " + sec.trim()).join("\n\n");
  const briefingFor = (...prefixes) => fill(briefingSections(...prefixes), vars).replace(/\{\{(\w+)\}\}/g, "[$1]");

  // The whisper is generated by the model from the conversation, guided by the template in
  // prompts/briefing.md. A prompt-type handoff avoids depending on dynamic-variable rendering
  // inside a static message, which is not confirmed for single-prompt agents.
  const whisperPrompt = (who, role, briefing) => [
    `You are ${vars.agent_name}, the intake assistant. You have just reached ${who}, a staff member. The caller is on hold and cannot hear you.`,
    `Speak this briefing in English, quickly and in one breath, under 8 seconds, filling in the details from the conversation so far:`,
    `"Hi ${who}, ${vars.agent_name} here. I've got [caller's full name], ${role}, [English, Spanish, or 'limited English, speaks <language>']. [If they confirmed a number: 'Callback' followed by the digits. If they said the number they're calling from is fine: 'Best number is the one they're calling from.'] Stay on to take it, or hang up and I'll try the next person."`,
    `If the caller volunteered why they're calling, add one short clause after the language quoting three to eight of the caller's own words: "They mentioned [their exact words]." Never add legal labels the caller did not say themselves (no "retaliation", "wrongful termination", "discrimination", "harassment claim"). If they didn't volunteer anything, add nothing. If the caller asked for Walter, Peg, or Anthony by name, add: "They asked for [name] by name." If the caller said they might hurt themselves or sounded in danger, say first: "Heads up, this caller may be in crisis." If no name was captured, say "a caller who didn't give their name" in place of the name. If no callback number was captured, say "No callback number captured." Do not add anything else. Do not characterize the legal matter.`,
    `Reference template follows.\n\n${briefing}`,
  ].join("\n");

  const transferMode = env("TRANSFER_MODE", "warm");
  if (!["warm", "cold"].includes(transferMode)) { console.error('TRANSFER_MODE must be "warm" or "cold"'); process.exit(2); }

  const transferTool = (name, description, number, who, role, holdText, briefing) => ({
    type: "transfer_call",
    name,
    description,
    transfer_destination: { type: "predefined", number },
    transfer_option: transferMode === "warm" ? {
      type: "warm_transfer",
      agent_detection_timeout_ms: cfg.transfer.agent_detection_timeout_ms,
      transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
      on_hold_music: cfg.transfer.on_hold_music,
      opt_out_human_detection: cfg.transfer.opt_out_human_detection,
      show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
      private_handoff_option: { type: "prompt", prompt: whisperPrompt(who, role, briefing) },
    } : {
      type: "cold_transfer",
      transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
      show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
    },
    speak_during_execution: true,
    // Warm: a fixed hold line; the briefing goes to staff privately. Cold: no whisper exists, so
    // Maya tells the caller, in their language, what she is passing along, then transfers.
    execution_message_type: "prompt",
    execution_message_description: transferMode === "warm"
      ? `In the caller's language, in one short sentence, tell them you're connecting them with ${who} now and it may take a moment. Use their first name if you have it. Example: "${holdText}"`
      : `In the caller's language, say you are connecting them to ${who} now and that you will pass along their name and callback number. Two sentences at most. Do not characterize the legal matter.`,
  });

  const llmBody = {
    model: process.env[cfg.llm.model_env] || cfg.llm.model_default,
    model_temperature: cfg.llm.model_temperature,
    tool_call_strict_mode: cfg.llm.tool_call_strict_mode,
    general_prompt: prompt,
    begin_message: `Thanks for calling ${vars.firm_name}, this is ${vars.agent_name}, the firm's virtual assistant. Are you calling about a new matter, or do you already have a case with us?`,
    general_tools: [
      { type: "end_call", name: "end_call", description: "End the call after saying goodbye, or when the caller has hung up or gone silent." },
      transferTool(
        "transfer_to_intake",
        `Warm-transfer a new client (or anyone who asked for Walter, Peg, or Anthony) to the intake manager ${vars.intake_name}. Never use this for a caller who speaks neither English nor Spanish; use transfer_to_admin for them. Call only after name and phone are collected and you have told the caller you're connecting them.`,
        intakePhone, vars.intake_name, "a new client",
        `Thanks, James. Let me get you over to ${vars.intake_name}, one moment.`,
        briefingFor("Intake transfer, English", "Intake transfer, Spanish", "Senior management ask")
      ),
      transferTool(
        "transfer_to_admin",
        `Warm-transfer an existing client or an other-matter caller to the admin team member ${vars.admin_name}. Call only after name and phone are collected and you have told the caller you're connecting them.`,
        adminPhone, vars.admin_name, "an existing client or other matter",
        `Okay. Let me get you over to ${vars.admin_name}, one moment.`,
        briefingFor("Admin transfer (existing client)", "Admin transfer (other matter)")
      ),
    ],
  };

  const ids = loadIds();

  if (DRY) {
    const a = cfg.agent;
    const agentBody = buildAgentBody(a, vars, ids.llm_id || "<llm_id from create-retell-llm>", process.env.VOICE_ID || "<picked from /list-voices on the live run>");
    const leftovers = [...JSON.stringify({ llmBody, agentBody }).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const out = {
      dry_run: true,
      would_call: [
        ids.llm_id ? `PATCH /update-retell-llm/${ids.llm_id}` : "POST /create-retell-llm",
        process.env.VOICE_ID ? "(VOICE_ID set, /list-voices skipped)" : "GET /list-voices",
        ids.agent_id ? `PATCH /update-agent/${ids.agent_id}` : "POST /create-agent",
        process.env.RETELL_PHONE_NUMBER ? `PATCH /update-phone-number/${process.env.RETELL_PHONE_NUMBER}` : "GET /v2/list-phone-numbers, then PATCH /update-phone-number/<number>",
      ],
      env_used: { ...vars, intake_phone: intakePhone, admin_phone: adminPhone, model: llmBody.model, transfer_mode: transferMode },
      prompt_words: prompt.split(/\s+/).length,
      unfilled_placeholders: [...new Set(leftovers)],
      llmBody,
      agentBody,
    };
    console.log(JSON.stringify(out, null, 2));
    if (leftovers.length) { console.error(`\nUnfilled placeholders: ${[...new Set(leftovers)].join(", ")}`); process.exit(3); }
    return;
  }

  // Published versions are immutable. If the agent is published, open a new draft version first;
  // Retell then gives the LLM a matching draft version to update.
  let llmVersion;
  if (ids.agent_id) {
    const cur = await api("GET", `/get-agent/${ids.agent_id}`);
    if (cur.is_published) {
      const draft = await api("POST", `/create-agent-version/${ids.agent_id}`, { base_version: cur.version });
      llmVersion = draft.response_engine?.version;
      console.log(`Opened draft agent version ${draft.version} (LLM version ${llmVersion})`);
    } else {
      llmVersion = cur.response_engine?.version;
    }
  }

  let llm;
  if (ids.llm_id) {
    llm = await api("PATCH", `/update-retell-llm/${ids.llm_id}${llmVersion !== undefined ? `?version=${llmVersion}` : ""}`, llmBody);
    console.log(`Updated Retell LLM ${ids.llm_id}${llmVersion !== undefined ? ` version ${llmVersion}` : ""}`);
  } else {
    llm = await api("POST", "/create-retell-llm", llmBody);
    ids.llm_id = llm.llm_id;
    saveIds(ids);
    console.log(`Created Retell LLM ${ids.llm_id}`);
  }

  const voiceId = await pickVoice(process.env.VOICE_ID || cfg.agent.voice_id_default);
  const a = cfg.agent;
  const agentBody = buildAgentBody(a, vars, ids.llm_id, voiceId);
  if (llmVersion !== undefined) agentBody.response_engine.version = llmVersion;

  let agent;
  if (ids.agent_id) {
    agent = await api("PATCH", `/update-agent/${ids.agent_id}`, agentBody);
    console.log(`Updated agent ${ids.agent_id} (version ${agent.version ?? "?"})`);
  } else {
    agent = await api("POST", "/create-agent", agentBody);
    ids.agent_id = agent.agent_id;
    saveIds(ids);
    console.log(`Created agent ${ids.agent_id}`);
  }

  // Publish the draft version so inbound calls use it.
  await api("POST", `/publish-agent-version/${ids.agent_id}`, { version: agent.version ?? 0, version_title: "POC publish" });
  console.log(`Published agent version ${agent.version ?? 0}`);

  // Bind to a phone number.
  let number = process.env.RETELL_PHONE_NUMBER;
  if (!number) {
    const nums = await api("GET", "/v2/list-phone-numbers");
    const list = Array.isArray(nums) ? nums : nums?.items ?? nums?.phone_numbers ?? [];
    if (list.length === 1) number = list[0].phone_number;
    else if (list.length === 0) { console.log("No phone number on the account yet. Buy one in the Retell dashboard, then re-run with RETELL_PHONE_NUMBER set."); saveIds(ids); return; }
    else { console.log("Several numbers on the account. Set RETELL_PHONE_NUMBER to one of:\n  " + list.map((n) => n.phone_number).join("\n  ")); saveIds(ids); return; }
  }
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
  console.log(`  Model: ${llmBody.model}. Voice: ${voiceId}. Language: ${a.language}. Transfer mode: ${transferMode}.`);
  console.log(`  Ids saved to ${IDS_FILE} (not committed).`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
