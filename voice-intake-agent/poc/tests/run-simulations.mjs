#!/usr/bin/env node
// Runs Retell's built-in simulation tests against Maya: an LLM plays each caller persona in
// scenarios.json, the conversation runs against Maya's current LLM version with transfers mocked,
// Retell grades each transcript against the scenario's criteria, and this script adds its own code
// checks on every transcript (notice before the first name or number question, banned phrases,
// the right transfer tool, no caller name in the hand-off line, greeting names the firm).
//
// Env: RETELL_API_KEY (or an environment API credential), RETELL_BASE_URL optional,
//      SIM_MODEL (model that plays the caller, default gpt-5.5). Names come from ../agent/live.json.
// Usage: node poc/tests/run-simulations.mjs              sync scenarios, run all, wait, report
//        node poc/tests/run-simulations.mjs --only 1,4    run a subset by scenario id
//        node poc/tests/run-simulations.mjs --repeat 3    run every selected scenario 3 times
//        node poc/tests/run-simulations.mjs --report      re-render the last results without running
//        node poc/tests/run-simulations.mjs --prune       delete test definitions on this LLM that
//                                                         .retell-tests.json does not list
// Writes poc/tests/results.json and poc/tests/report.md (both gitignored). Exits 1 unless every
// run passes.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RETELL_BASE_URL || "https://api.retellai.com";
const KEY = process.env.RETELL_API_KEY;
const IDS = join(here, "..", "agent", ".retell-ids.json");
const TEST_IDS = join(here, ".retell-tests.json");
const RESULTS = join(here, "results.json");
const REPORT = join(here, "report.md");
const SIM_MODEL = process.env.SIM_MODEL || "gpt-5.5";
const live = JSON.parse(readFileSync(join(here, "..", "agent", "live.json"), "utf8"));
const names = { agent: live.agent_name, intake: live.intake_name, admin: live.admin_name, firm: live.firm_name };

async function api(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(BASE + path, { method, headers: { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (res.ok) return json;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await sleep(2000 * 2 ** attempt); continue; }
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
}
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => ({ agent_name: names.agent, intake_name: names.intake, admin_name: names.admin, firm_name: names.firm })[k] ?? `{{${k}}}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The failure text Retell actually returned on live calls (GET /v2/get-call), not an invented one.
const RETELL_FAIL_TEXT = "Transfer connected but could not be completed due to an error.. Please inform the customer that the transfer did not go through and offer to try again or assist them directly.";
const MOCK_OK = (tool) => ({ tool_name: tool, input_match_rule: { type: "any" }, output: JSON.stringify({ status: "transferred successfully" }), result: true });
const MOCK_FAIL = (tool) => ({ tool_name: tool, input_match_rule: { type: "any" }, output: RETELL_FAIL_TEXT, result: false });

function mocksFor(sc) {
  if (isStaff(sc)) {
    return ["bridge_transfer", "cancel_transfer"].map((t) => ({ tool_name: t, input_match_rule: { type: "any" }, output: JSON.stringify({ status: t === "bridge_transfer" ? "bridged" : "cancelled" }), result: true }));
  }
  return ["transfer_to_intake", "transfer_to_admin"].map((t) => ((sc.transferFails || []).includes(t) ? MOCK_FAIL(t) : MOCK_OK(t)));
}

// Staff-side scenarios run against the transfer agent that talks to the intake manager, with the
// simulated "caller" playing the staff member who picks up.
const isStaff = (sc) => (sc.engine || "main") !== "main";

async function engineFor(llmId, agentId) {
  const agent = await api("GET", `/get-agent/${agentId}`);
  return { llm_id: llmId, version: agent.response_engine?.version ?? agent.version, agent_version: agent.version };
}

async function currentEngines() {
  const ids = JSON.parse(readFileSync(IDS, "utf8"));
  const engines = { main: await engineFor(ids.llm_id, ids.agent_id) };
  for (const [dest, t] of Object.entries(ids.transfer_agents || {})) engines[`transfer_${dest}`] = await engineFor(t.llm_id, t.agent_id);
  return engines;
}

function loadKnown() {
  return existsSync(TEST_IDS) ? JSON.parse(readFileSync(TEST_IDS, "utf8")) : {};
}

async function syncDefinitions(scenarios, engines) {
  const known = loadKnown();
  for (const sc of scenarios) {
    const engine = engines[sc.engine || "main"];
    if (!engine) throw new Error(`Scenario ${sc.id} needs engine ${sc.engine}, which is not in .retell-ids.json. Publish with create-agent.mjs first.`);
    const body = {
      name: `${String(sc.id).padStart(2, "0")} ${sc.name}`,
      user_prompt: fill(sc.caller),
      metrics: sc.criteria.map(fill),
      llm_model: SIM_MODEL,
      response_engine: { type: "retell-llm", llm_id: engine.llm_id, version: engine.version },
      tool_mocks: mocksFor(sc),
      // A live call always has caller ID unless it is blocked; give the simulated caller one too.
      dynamic_variables: sc.dynamic_variables || { user_number: "+14155550123" },
    };
    if (known[sc.id]) {
      try { await api("PUT", `/update-test-case-definition/${known[sc.id]}`, body); continue; }
      catch (e) { if (!/HTTP 404/.test(e.message)) throw e; delete known[sc.id]; }
    }
    const def = await api("POST", "/create-test-case-definition", body);
    known[sc.id] = def.test_case_definition_id;
    writeFileSync(TEST_IDS, JSON.stringify(known, null, 2) + "\n");
  }
  writeFileSync(TEST_IDS, JSON.stringify(known, null, 2) + "\n");
  return known;
}

async function prune(engine) {
  const keep = new Set(Object.values(loadKnown()));
  if (!keep.size) { console.error("No .retell-tests.json; refusing to prune everything."); process.exit(2); }
  const list = await api("GET", `/v2/list-test-case-definitions?type=retell-llm&llm_id=${engine.llm_id}&limit=1000`);
  const defs = Array.isArray(list) ? list : list?.items ?? [];
  const extra = defs.filter((d) => !keep.has(d.test_case_definition_id));
  console.log(`${defs.length} definitions on ${engine.llm_id}; keeping ${defs.length - extra.length}, deleting ${extra.length}.`);
  let n = 0;
  // One at a time with a short pause: Retell throttles bursts of deletes.
  for (const d of extra) {
    await api("DELETE", `/delete-test-case-definition/${d.test_case_definition_id}`).catch((e) => { if (!/HTTP 404/.test(e.message)) throw e; });
    n++;
    if (n % 10 === 0) process.stdout.write(`  ${n}/${extra.length}\r`);
    await sleep(250);
  }
  console.log(`\nDeleted ${n}.`);
}

function transcriptLines(snapshot) {
  // Best effort over the snapshot shapes Retell documents.
  const t = snapshot?.transcript_object || snapshot?.transcript || snapshot?.messages || snapshot?.transcript_with_tool_calls || [];
  if (typeof t === "string") return t.split("\n").map((l) => ({ role: /^agent/i.test(l) ? "agent" : "user", content: l.replace(/^(agent|user):\s*/i, "") }));
  return (Array.isArray(t) ? t : []).map((u) => ({ role: u.role, content: u.content ?? (u.name ? `[tool ${u.name}]` : ""), ...(u.name ? { tool: u.name } : {}) }));
}

// "transcription" alone is the refusal line ("can't continue without transcription"), not the notice.
const NOTICE = /transcript(?!ion)|transcribed|transcripci[oó]n de la llamada|se transcribe/i;
const toolOf = (l) => l.tool || (/^\[tool (\w+)\]$/.exec(l.content || "") || [])[1];
const BANNED = [/\bvirtual assistant\b/i, /\bnot recorded\b/i, /no se graba/i, /\bI understand\b/i, /\bcalm down\b/i, /sorry you feel that way/i, /\bunfortunately\b/i, /\bour policy\b/i, /\bquick note\b/i, /\bmm-?hmm\b/i, /\buh-?huh\b/i];

/** Mechanical rules, checked in code on every run so the model grader can't wave them through. */
export function codeChecks(sc, lines) {
  const problems = [];
  const agentIdx = lines.map((l, i) => ({ ...l, i })).filter((l) => l.role === "agent");
  if (!lines.length) return ["no transcript returned"];

  if (!agentIdx.length || !agentIdx[0].content.includes(names.firm)) problems.push(`greeting does not name ${names.firm}`);

  const ask = agentIdx.find((l) => /\b(name|number|nombre|n[uú]mero)\b[^?]*\?/i.test(l.content));
  const notice = agentIdx.find((l) => NOTICE.test(l.content));
  if (isStaff(sc)) {
    // Staff side: only which decision the transfer agent made, and that it never bridged without a yes.
    const decisions = lines.filter((l) => l.role === "tool_call_invocation" && /^(bridge|cancel)_transfer$/.test(toolOf(l) || ""));
    const got = decisions.length ? toolOf(decisions[decisions.length - 1]) : "none";
    return sc.expectTool && got !== sc.expectTool ? [`expected ${sc.expectTool}, got ${got}`] : [];
  }
  const transfers = lines.filter((l) => l.role === "tool_call_invocation" && /^transfer_/.test(toolOf(l) || ""));
  if (sc.notice !== false) {
    if (ask && (!notice || notice.i > ask.i)) problems.push(`transcript notice ${notice ? "came after" : "missing before"} the first name/number question ("${ask.content.slice(0, 80)}")`);
    if (!ask && transfers.length && !notice) problems.push("transferred without ever giving the transcript notice");
  } else if (notice) {
    problems.push("gave the transcript notice on a call that should not have it");
  }
  // A repeat right after the caller didn't hear it ("What was that?") is allowed.
  const notices = agentIdx.filter((l) => NOTICE.test(l.content) && !/what was that|sorry\?|didn't (hear|catch)|say that again|repeat|¿c[oó]mo\?/i.test(lines[l.i - 1]?.content || "")).length;
  if (notices > 1) problems.push(`transcript notice said ${notices} times`);

  for (const l of agentIdx) for (const re of BANNED) if (re.test(l.content)) problems.push(`banned phrase ${re.source.replace(/\\b/g, "")} in "${l.content.slice(0, 80)}"`);

  const expect = sc.expectTool;
  const used = transfers.length ? toolOf(transfers[transfers.length - 1]) : "none";
  if (expect && used !== expect) problems.push(`expected ${expect}, got ${used}`);

  const first = sc.callerFirstName || (/^You are ([A-Z][a-z]+) [A-Z]/.exec(sc.caller) || [])[1];
  if (first && transfers.length) {
    const idx = lines.indexOf(transfers[0]);
    const turn = [...lines.slice(0, idx)].reverse().find((l) => l.role === "agent");
    // Only the hand-off sentence itself; "Thanks, Nora." earlier in the same turn is the one allowed use.
    const handoff = (turn?.content || "").split(/(?<=[.!?])\s+/).find((x) => /get you over to|getting .* on the line|le comunico|connect(ing)? you|transferring you/i.test(x));
    if (handoff && new RegExp(`\\b${first}\\b`).test(handoff)) problems.push(`hand-off line uses the caller's name: "${handoff}"`);
  }
  // Intake hand-offs say "an intake manager", never a staff first name.
  if (transfers.length && toolOf(transfers[transfers.length - 1]) === "transfer_to_intake") {
    const idx = lines.indexOf(transfers[transfers.length - 1]);
    const said = lines.slice(Math.max(0, idx - 4), idx).filter((l) => l.role === "agent").map((l) => l.content).join(" ");
    if (!/intake manager|encargad[oa]s? de admisi[oó]n/i.test(said)) problems.push(`intake hand-off did not say "intake manager": "${said.slice(-120)}"`);
  }
  return problems;
}

function render(results, engine) {
  const runs = results.flatMap((r) => r.runs);
  const pass = runs.filter((r) => r.status === "pass").length;
  let md = `# Maya simulation results\n\nAgent version ${engine.agent_version}, LLM version ${engine.version}, caller played by ${engine.sim_model || SIM_MODEL}. ${pass}/${runs.length} runs passed. ${new Date().toISOString()}\n\n`;
  md += `| # | Scenario | Passed |\n|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${r.name} | ${r.runs.filter((x) => x.status === "pass").length}/${r.runs.length} |\n`;
  for (const r of results) {
    md += `\n## ${r.id}. ${r.name} — ${r.runs.filter((x) => x.status === "pass").length}/${r.runs.length}\n\n**Criteria:**\n${r.criteria.map((c) => `- ${c}`).join("\n")}\n`;
    r.runs.forEach((run, k) => {
      md += `\n### Run ${k + 1}: ${run.status.toUpperCase()}\n\n`;
      if (run.grader_status && run.grader_status !== "pass") md += `**Grader (${run.grader_status}):** ${run.result_explanation}\n\n`;
      else if (run.result_explanation) md += `**Grader:** ${run.result_explanation}\n\n`;
      if (run.code_problems.length) md += `**Code checks failed:**\n${run.code_problems.map((p) => `- ${p}`).join("\n")}\n\n`;
      md += `**Transcript:**\n\n`;
      for (const l of run.transcript) md += `- **${l.role}:** ${l.content}\n`;
    });
  }
  writeFileSync(REPORT, md);
}

async function runBatch(engine, defIds) {
  if (!defIds.length) return null;
  const batch = await api("POST", "/create-batch-test", {
    response_engine: { type: "retell-llm", llm_id: engine.llm_id, version: engine.version },
    test_case_definition_ids: defIds,
  });
  return batch.test_case_batch_job_id || batch.batch_test_id || batch.id;
}

async function main() {
  const args = process.argv.slice(2);
  const scenarios = JSON.parse(readFileSync(join(here, "scenarios.json"), "utf8"));
  if (args.includes("--report")) {
    const saved = JSON.parse(readFileSync(RESULTS, "utf8"));
    render(saved.results, saved.engine); console.log(`wrote ${REPORT}`); return;
  }
  const engines = await currentEngines();
  const engine = engines.main;
  if (args.includes("--prune")) { await prune(engine); return; }

  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",").map(Number)) : null;
  const selected = only ? scenarios.filter((s) => only.has(s.id)) : scenarios;
  const repIdx = args.indexOf("--repeat");
  const repeat = repIdx >= 0 ? Math.max(1, Number(args[repIdx + 1]) || 1) : 1;

  console.log(`Maya agent version ${engine.agent_version}, LLM ${engine.llm_id} v${engine.version}. Caller model: ${SIM_MODEL}.`);
  const known = await syncDefinitions(scenarios, engines);
  console.log(`${Object.keys(known).length} scenario definitions in sync on Retell.`);

  // One batch per engine (Maya, or a staff-side transfer agent) per repeat.
  const groups = {};
  for (const sc of selected) (groups[sc.engine || "main"] ||= []).push(sc);
  const batchesByGroup = {};
  for (const [g, list] of Object.entries(groups)) {
    batchesByGroup[g] = [];
    for (let k = 0; k < repeat; k++) batchesByGroup[g].push(await runBatch(engines[g], list.map((s) => known[s.id])));
  }
  const batchIds = Object.values(batchesByGroup).flat();
  console.log(`${batchIds.length} batch(es) started for ${selected.length} scenario(s) x ${repeat}. Waiting...`);

  const runsByBatch = {};
  for (let i = 0; i < 180; i++) {
    await sleep(10000);
    let done = 0;
    for (const b of batchIds) {
      const list = await api("GET", `/v2/list-test-runs/${b}?limit=100`);
      runsByBatch[b] = Array.isArray(list) ? list : list?.items ?? list?.data ?? [];
      done += runsByBatch[b].filter((r) => ["pass", "fail", "error"].includes(r.status)).length;
    }
    process.stdout.write(`  ${done}/${selected.length * repeat} finished\r`);
    if (done >= selected.length * repeat) break;
  }
  console.log();

  const results = selected.map((sc) => ({
    id: sc.id, name: sc.name, criteria: sc.criteria.map(fill),
    runs: batchesByGroup[sc.engine || "main"].map((b) => {
      const r = (runsByBatch[b] || []).find((x) => x.test_case_definition_id === known[sc.id]) || {};
      const transcript = transcriptLines(r.transcript_snapshot);
      const code_problems = r.status ? codeChecks(sc, transcript) : [];
      const status = !r.status ? "missing" : r.status === "pass" && !code_problems.length ? "pass" : r.status === "error" ? "error" : "fail";
      return { batch: b, status, grader_status: r.status || "missing", result_explanation: r.result_explanation || "", code_problems, transcript, test_case_job_id: r.test_case_job_id };
    }),
  }));
  engine.sim_model = SIM_MODEL;
  writeFileSync(RESULTS, JSON.stringify({ engine, batchIds, ran_at: new Date().toISOString(), results }, null, 2) + "\n");
  render(results, engine);
  for (const r of results) {
    const p = r.runs.filter((x) => x.status === "pass").length;
    console.log(`  ${p === r.runs.length ? "PASS" : "FAIL"} ${p}/${r.runs.length}  ${r.id}. ${r.name}`);
    for (const run of r.runs.filter((x) => x.status !== "pass")) {
      if (run.grader_status !== "pass") console.log(`          grader: ${run.result_explanation.slice(0, 300)}`);
      for (const pr of run.code_problems) console.log(`          code: ${pr}`);
    }
  }
  const all = results.flatMap((r) => r.runs);
  const passed = all.filter((x) => x.status === "pass").length;
  console.log(`\n${passed}/${all.length} runs passed. Report: ${REPORT}`);
  if (passed !== all.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
