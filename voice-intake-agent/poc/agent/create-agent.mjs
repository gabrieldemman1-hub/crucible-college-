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
const RUNTIME_VARS = [/^user_number$/, /^current_time_/];

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
  };
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
  // The whisper is generated by the model from the conversation. A prompt-type handoff avoids
  // depending on dynamic-variable rendering inside a static message, which is not confirmed for
  // single-prompt agents. prompts/briefing.md documents the production (multi-person) wording; the
  // POC wording is the one below.
  const whisperPrompt = (dest) => {
    const who = dest === "intake" ? vars.intake_name : vars.admin_name;
    const team = /^(the|our) /i.test(who);
    const hi = team ? `Hi, ${vars.agent_name} here` : `Hi ${who}, ${vars.agent_name} here`;
    const roles = dest === "intake"
      ? `"a new client" by default. If the caller said they already have a case (for example a caller in crisis sent to intake anyway), "who says they already have a case". If they called about someone else, "[caller's name] calling for [that person's name]".`
      : `"who says they already have a case" for an existing client. For a vendor, court, other law firm, or anyone else, "calling about another matter, from [their organization, if they said]". If they called about someone else, "[caller's name] calling for [that person's name], who has a case with us".`;
    const told = dest === "intake"
      ? `that ${who} is on the intake team and will get them to the right attorney`
      : `that they're going to the admin team, who will get them to their attorney`;
    return [
      `You are ${vars.agent_name}, ${vars.firm_name}'s virtual assistant. You have just reached ${team ? who : `${who}, a staff member,`} on a private line. The caller is on hold with music and cannot hear either of you. This is a two-way conversation with ${who}, not an announcement.`,
      ``,
      `Caller ID of the caller: {{user_number}}. If that is blank, anonymous, or still in curly braces, caller ID is unavailable.`,
      ``,
      `STEP 1, the briefing. Speak it quickly, in one breath, under 8 seconds for a calm caller, filling in details from the conversation so far:`,
      `"${hi}. I've got [caller's full name], [role]. [Language, only if the caller did not speak English: 'Speaks Spanish.' only if they spoke full Spanish sentences to you (a lone "sí" or "hola" in an English call is English: say nothing about language); for any other language, 'Limited English, speaks <that language, e.g. Mandarin>.' Never guess Spanish for a language you didn't hear.] [Callback: if they gave or confirmed a number, 'Callback' and the digits in groups of three, three, four. If they said the number they're calling from is fine and caller ID is available, 'Callback is the number they're calling from,' and those digits in groups of three, three, four. If there is no number at all, 'No callback number captured.'] Stay on to take it, or hang up and I'll take a message."`,
      `[role] is ${roles} Never say "an existing client or other matter".`,
      `If the caller volunteered why they're calling, add one short clause before "Stay on to take it" quoting three to eight of the caller's own words: "They mentioned [their exact words]." Never add legal labels the caller did not say themselves (no "retaliation", "wrongful termination", "discrimination", "harassment claim").`,
      `If the caller said they might hurt themselves, don't want to be here, or sounded in danger, the very first words after the greeting are "Heads up, this caller may be in crisis." Then what they said, in their own words, in one sentence, then the rest.`,
      `Otherwise, if the caller was upset, angry, frustrated, or distressed, the briefing can run to 15 seconds and the order matters: greeting, then "Heads up, this caller is upset." before the caller's name or anything else, then in one sentence what they are upset about in their own words, what they asked for (for example, an attorney), and what you told them (for example, ${told}). Then the rest as usual.`,
      `If the caller asked for Walter, Peg, Anthony, or any other staff member by name, add: "They asked for [name] by name." If no name was captured, say "a caller who didn't give their name" in place of the name. If the caller was joking, rude, or gave obviously fake answers, add "Heads up, this caller has been joking around" (or "has been rude").`,
      ``,
      `STEP 2, listen. After the briefing, stop and let ${who} respond. They may ask questions before taking the call, for example: "What exactly did they say?", "How angry are they?", "Did they say what it's about?", "Did they ask for anyone?", "What did you tell them?", "Have they called before today?", "Did they mention a deadline or a court date?" Answer each in one or two sentences, from what actually happened on this call, quoting the caller's own words where you can. If the caller didn't say, say "They didn't say." Never guess, never characterize the legal matter, never add anything the caller didn't say. Keep it moving; the caller is waiting.`,
      ``,
      `STEP 3, bridge. The caller is connected as soon as ${who} says anything that is not a question ("okay", "go ahead", "put them through"), or after a few seconds with no further question. Say "Connecting you now." The only way to decline is to hang up; then the transfer fails and you go back to the caller with the callback message.`,
    ].join("\n");
  };

  const transferMode = env("TRANSFER_MODE", "warm");
  if (!["warm", "cold"].includes(transferMode)) { console.error('TRANSFER_MODE must be "warm" or "cold"'); process.exit(2); }

  const transferTool = (name, description, number, dest) => {
    const who = dest === "intake" ? vars.intake_name : vars.admin_name;
    return {
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
        private_handoff_option: { type: "prompt", prompt: whisperPrompt(dest) },
      } : {
        type: "cold_transfer",
        transfer_ring_duration_ms: cfg.transfer.transfer_ring_duration_ms,
        show_transferee_as_caller: cfg.transfer.show_transferee_as_caller,
      },
      speak_during_execution: true,
      // Warm: the hand-off line is normally already said, so this stays minimal; the briefing goes
      // to staff privately. Cold: no whisper exists, so Maya tells the caller what she passes along.
      execution_message_type: "prompt",
      execution_message_description: transferMode === "warm"
        ? `In the caller's language. If your previous turn already told the caller you're getting them over to ${who}, say only "One moment." Otherwise say "Okay, let me get you over to ${who}, one moment." Never use the caller's name.`
        : `In the caller's language, say you are connecting them to ${who} now and that you will pass along their name and callback number. Two sentences at most. Never use the caller's name. Do not characterize the legal matter.`,
    };
  };

  const llmBody = {
    model: process.env[cfg.llm.model_env] || cfg.llm.model_default,
    model_temperature: cfg.llm.model_temperature,
    tool_call_strict_mode: cfg.llm.tool_call_strict_mode,
    general_prompt: prompt,
    begin_message: `Thanks for calling ${vars.firm_name}, this is ${vars.agent_name}, the firm's virtual assistant. Are you calling about a new matter, or do you already have a case with us?`,
    general_tools: [
      { type: "end_call", name: "end_call", description: "End the call only for a reason listed in section 8 of the prompt (wrong number, refused transcription, failed transfer after the caller answered the last question, message taken, silence after both nudges, or the caller hung up). Say goodbye first unless the caller has hung up." },
      transferTool(
        "transfer_to_intake",
        `Warm-transfer to ${vars.intake_name} on the intake team. Use for: new clients and anyone unsure, in any language; anyone who asked for Walter, Peg, or Anthony; any caller who may be in crisis, even an existing client; non-employment matters. Call only after the transcript fact, name, and number (or the caller refused them), right after the hand-off line.`,
        intakePhone, "intake"
      ),
      transferTool(
        "transfer_to_admin",
        `Warm-transfer to ${vars.admin_name}. Use for: existing clients (they say they already have a case with us), people calling for someone who already has a case, and other matters (vendors, courts, other law firms, sales). Never for a caller who may be in crisis. Call only after the transcript fact, name, and number (or the caller refused them), right after the hand-off line.`,
        adminPhone, "admin"
      ),
    ],
  };

  const leftovers = (agentBody) => leftoverPlaceholders({ llmBody, agentBody });

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
  await api("POST", `/publish-agent-version/${ids.agent_id}`, { version: agent.version ?? 0, version_title: (process.env.VERSION_NOTE || "POC publish").slice(0, 100) });
  console.log(`Published agent version ${agent.version ?? 0}`);

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
  console.log(`  Model: ${llmBody.model}. Voice: ${voiceId}. Language: ${a.language}. Transfer mode: ${transferMode}.`);
  console.log(`  Ids saved to ${IDS_FILE}. Commit it so every checkout updates this agent.`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
