#!/usr/bin/env node
// First thing to run in a session that can reach Retell. Confirms the key works, shows the phone
// numbers on the account and what each is bound to, and checks the local setup. Read-only.
//
// Env: RETELL_API_KEY, or an API credential on the environment for api.retellai.com. INTAKE_PHONE, ADMIN_PHONE, RETELL_PHONE_NUMBER, FIRM_NAME,
//      MAIN_OFFICE_NUMBER are checked if present. RETELL_BASE_URL optional.
// Usage: node poc/agent/preflight.mjs

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const KEY = process.env.RETELL_API_KEY;
const IDS_FILE = join(here, ".retell-ids.json");
const E164 = /^\+[1-9]\d{7,14}$/;

let problems = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const warn = (msg) => console.log(`  warn  ${msg}`);
const fail = (msg) => { problems++; console.log(`  FAIL  ${msg}`); };

async function api(path) {
  const res = await fetch(BASE + path, { headers: KEY ? { Authorization: `Bearer ${KEY}` } : {} });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

console.log("Local setup");
if (!KEY) warn("RETELL_API_KEY not set; expecting an API credential on the environment for api.retellai.com (checked below).");
else if (!/^key_[0-9a-f]{20,}$/i.test(KEY)) warn(`RETELL_API_KEY does not look like a Retell key (starts "${KEY.slice(0, 4)}", ${KEY.length} chars).`);
else ok(`RETELL_API_KEY present (${KEY.length} chars).`);

for (const name of ["INTAKE_PHONE", "ADMIN_PHONE", "RETELL_PHONE_NUMBER", "MAIN_OFFICE_NUMBER"]) {
  const v = process.env[name];
  if (!v) warn(`${name} not set${name === "INTAKE_PHONE" || name === "ADMIN_PHONE" ? " (required by create-agent.mjs)" : ""}.`);
  else if (!E164.test(v)) fail(`${name}="${v}" is not E.164 (expected like +14155550101).`);
  else ok(`${name}=${v}`);
}
if (process.env.INTAKE_PHONE && process.env.INTAKE_PHONE === process.env.ADMIN_PHONE) warn("INTAKE_PHONE and ADMIN_PHONE are the same phone; the admin scenario will ring the same handset.");
if (!process.env.FIRM_NAME) warn('FIRM_NAME not set; Maya will say "the firm".');
for (const name of ["INTAKE_NAME", "ADMIN_NAME"]) if (!process.env[name]) warn(`${name} not set; default first name will be used.`);

const ids = existsSync(IDS_FILE) ? JSON.parse(readFileSync(IDS_FILE, "utf8")) : {};
if (ids.agent_id) ok(`Previous run found: llm ${ids.llm_id}, agent ${ids.agent_id}, number ${ids.phone_number || "(unbound)"}. create-agent.mjs will update, not duplicate.`);
else ok("No previous run recorded; create-agent.mjs will create the LLM and agent.");

console.log("\nRetell API");
let reach;
try { reach = await api("/list-voices"); }
catch (e) { fail(`Cannot reach ${BASE}: ${e.cause?.code || e.message}. Allow api.retellai.com in the environment's network settings (or run on a laptop).`); console.log(`\n${problems} problem(s).`); process.exit(1); }
const blocked = (r) => /allowlist|egress|network|proxy/i.test(typeof r.json === "string" ? r.json : JSON.stringify(r.json ?? ""));
if (blocked(reach)) { fail(`api.retellai.com is blocked by this environment's network policy (HTTP ${reach.status}). Add api.retellai.com to the allowed hosts in the environment settings, then start a new session.`); console.log(`\n${problems} problem(s).`); process.exit(1); }
if (reach.status === 401 || reach.status === 403) fail(KEY
  ? `Key rejected (HTTP ${reach.status}). Create a new key in the Retell dashboard and update RETELL_API_KEY.`
  : `No key reached Retell (HTTP ${reach.status}). Either add an API credential on the environment (Allowed websites: api.retellai.com, header Authorization, prefix Bearer) or set RETELL_API_KEY. Then start a new session.`);
else if (reach.status !== 200) fail(`GET /list-voices -> HTTP ${reach.status}: ${JSON.stringify(reach.json).slice(0, 200)}`);
else {
  const voices = Array.isArray(reach.json) ? reach.json : reach.json?.voices ?? [];
  const eleven = voices.filter((v) => String(v.provider || "").toLowerCase().includes("eleven"));
  ok(`Key accepted. ${voices.length} voices available, ${eleven.length} from ElevenLabs.`);
  if (process.env.VOICE_ID && !voices.some((v) => v.voice_id === process.env.VOICE_ID)) fail(`VOICE_ID=${process.env.VOICE_ID} is not in /list-voices.`);
}

const nums = await api("/v2/list-phone-numbers");
if (nums.status !== 200) fail(`GET /v2/list-phone-numbers -> HTTP ${nums.status}: ${JSON.stringify(nums.json).slice(0, 200)}`);
else {
  const list = Array.isArray(nums.json) ? nums.json : nums.json?.phone_numbers ?? [];
  if (!list.length) fail("No phone number on the account. Buy one in the Retell dashboard (Phone Numbers).");
  for (const n of list) {
    const bound = (n.inbound_agents || []).map((a) => `${a.agent_id} (weight ${a.weight ?? "?"})`).join(", ") || (n.inbound_agent_id ? n.inbound_agent_id : "nothing");
    const mine = ids.agent_id && bound.includes(ids.agent_id) ? "  <- this POC's agent" : "";
    ok(`Number ${n.phone_number}${n.nickname ? ` "${n.nickname}"` : ""}: inbound bound to ${bound}${mine}`);
  }
  const want = process.env.RETELL_PHONE_NUMBER;
  if (want && !list.some((n) => n.phone_number === want)) fail(`RETELL_PHONE_NUMBER=${want} is not on this account. Numbers: ${list.map((n) => n.phone_number).join(", ")}`);
  if (!want && list.length > 1) warn(`Several numbers on the account; set RETELL_PHONE_NUMBER to the one for the demo.`);
}

if (ids.agent_id) {
  const ag = await api(`/get-agent/${ids.agent_id}`);
  if (ag.status === 200) ok(`Agent ${ids.agent_id} exists: "${ag.json.agent_name}", language ${ag.json.language}, voice ${ag.json.voice_id}.`);
  else warn(`Agent ${ids.agent_id} from .retell-ids.json not found (HTTP ${ag.status}); create-agent.mjs will fail on update. Delete .retell-ids.json to start fresh.`);
}

console.log(problems ? `\n${problems} problem(s) to fix before create-agent.mjs.` : "\nReady. Next: node poc/agent/create-agent.mjs --voices, then node poc/agent/create-agent.mjs");
process.exit(problems ? 1 : 0);
