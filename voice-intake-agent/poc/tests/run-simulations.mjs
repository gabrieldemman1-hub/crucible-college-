#!/usr/bin/env node
// Runs Retell's built-in simulation tests against Maya: an LLM plays each caller persona in
// scenarios.json, the conversation runs against Maya's current LLM version with transfers mocked,
// and Retell grades each transcript against the scenario's criteria.
//
// Env: RETELL_API_KEY (or an environment API credential), RETELL_BASE_URL optional,
//      SIM_MODEL (model that plays the caller, default gpt-4.1-mini), INTAKE_NAME, ADMIN_NAME,
//      FIRM_NAME, AGENT_NAME (defaults match create-agent.mjs).
// Usage: node poc/tests/run-simulations.mjs              sync scenarios, run all, wait, report
//        node poc/tests/run-simulations.mjs --only 1,4    run a subset by scenario id
//        node poc/tests/run-simulations.mjs --report      re-render the last results without running
// Writes poc/tests/results.json and poc/tests/report.md (both gitignored).

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
const SIM_MODEL = process.env.SIM_MODEL || "gpt-4.1-mini";
const names = { agent: process.env.AGENT_NAME || "Maya", intake: process.env.INTAKE_NAME || "John", admin: process.env.ADMIN_NAME || "John", firm: process.env.FIRM_NAME || "the firm" };

async function api(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  return json;
}
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => ({ agent_name: names.agent, intake_name: names.intake, admin_name: names.admin, firm_name: names.firm })[k] ?? `{{${k}}}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MOCK_OK = (tool) => ({ tool_name: tool, input_match_rule: { type: "any" }, output: JSON.stringify({ status: "transferred successfully" }), result: true });
const MOCK_FAIL = (tool) => ({ tool_name: tool, input_match_rule: { type: "any" }, output: JSON.stringify({ status: "transfer failed", reason: "no answer" }), result: false });

function mocksFor(sc) {
  const m = [];
  for (const t of ["transfer_to_intake", "transfer_to_admin"]) m.push((sc.transferFails || []).includes(t) ? MOCK_FAIL(t) : MOCK_OK(t));
  return m;
}

async function currentLlm() {
  const ids = JSON.parse(readFileSync(IDS, "utf8"));
  const agent = await api("GET", `/get-agent/${ids.agent_id}`);
  return { llm_id: ids.llm_id, version: agent.response_engine?.version ?? agent.version, agent_version: agent.version };
}

async function syncDefinitions(scenarios, engine) {
  const known = existsSync(TEST_IDS) ? JSON.parse(readFileSync(TEST_IDS, "utf8")) : {};
  for (const sc of scenarios) {
    const body = {
      name: `${String(sc.id).padStart(2, "0")} ${sc.name}`,
      user_prompt: fill(sc.caller),
      metrics: sc.criteria.map(fill),
      llm_model: SIM_MODEL,
      response_engine: { type: "retell-llm", llm_id: engine.llm_id, version: engine.version },
      tool_mocks: mocksFor(sc),
    };
    if (known[sc.id]) {
      try { await api("PATCH", `/update-test-case-definition/${known[sc.id]}`, body); continue; }
      catch (e) { if (!/404/.test(e.message)) throw e; delete known[sc.id]; }
    }
    const def = await api("POST", "/create-test-case-definition", body);
    known[sc.id] = def.test_case_definition_id;
  }
  writeFileSync(TEST_IDS, JSON.stringify(known, null, 2) + "\n");
  return known;
}

function transcriptLines(snapshot) {
  // Best effort over the two snapshot shapes Retell documents.
  const t = snapshot?.transcript_object || snapshot?.transcript || snapshot?.messages || snapshot?.transcript_with_tool_calls || [];
  if (typeof t === "string") return t.split("\n").map((l) => ({ role: /^agent/i.test(l) ? "agent" : "user", content: l.replace(/^(agent|user):\s*/i, "") }));
  return (Array.isArray(t) ? t : []).map((u) => ({ role: u.role, content: u.content ?? (u.name ? `[tool ${u.name}]` : "") }));
}

function render(results, engine) {
  const pass = results.filter((r) => r.status === "pass").length;
  let md = `# Maya simulation results\n\nAgent version ${engine.agent_version}, LLM version ${engine.version}, caller played by ${SIM_MODEL}. ${pass}/${results.length} passed. ${new Date().toISOString()}\n\n`;
  md += `| # | Scenario | Result |\n|---|---|---|\n`;
  for (const r of results) md += `| ${r.id} | ${r.name} | ${r.status.toUpperCase()} |\n`;
  for (const r of results) {
    md += `\n## ${r.id}. ${r.name} — ${r.status.toUpperCase()}\n\n`;
    if (r.result_explanation) md += `**Grader:** ${r.result_explanation}\n\n`;
    md += `**Criteria:**\n${r.criteria.map((c) => `- ${c}`).join("\n")}\n\n**Transcript:**\n\n`;
    for (const l of r.transcript) md += `- **${l.role}:** ${l.content}\n`;
  }
  writeFileSync(REPORT, md);
}

async function main() {
  const args = process.argv.slice(2);
  const scenarios = JSON.parse(readFileSync(join(here, "scenarios.json"), "utf8"));
  if (args.includes("--report")) {
    const saved = JSON.parse(readFileSync(RESULTS, "utf8"));
    render(saved.results, saved.engine); console.log(`wrote ${REPORT}`); return;
  }
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",").map(Number)) : null;
  const selected = only ? scenarios.filter((s) => only.has(s.id)) : scenarios;

  const engine = await currentLlm();
  console.log(`Maya agent version ${engine.agent_version}, LLM ${engine.llm_id} v${engine.version}. Caller model: ${SIM_MODEL}.`);
  const known = await syncDefinitions(scenarios, engine);
  console.log(`${Object.keys(known).length} scenario definitions in sync on Retell.`);

  const batch = await api("POST", "/create-batch-test", {
    response_engine: { type: "retell-llm", llm_id: engine.llm_id, version: engine.version },
    test_case_definition_ids: selected.map((s) => known[s.id]),
  });
  const batchId = batch.test_case_batch_job_id || batch.batch_test_id || batch.id;
  console.log(`Batch ${batchId} started with ${selected.length} scenario(s). Waiting...`);

  let runs = [];
  for (let i = 0; i < 120; i++) {
    await sleep(10000);
    const list = await api("GET", `/v2/list-test-runs/${batchId}?limit=100`);
    runs = Array.isArray(list) ? list : list?.items ?? list?.data ?? [];
    const done = runs.filter((r) => ["pass", "fail", "error"].includes(r.status)).length;
    process.stdout.write(`  ${done}/${selected.length} finished\r`);
    if (runs.length && done === runs.length && runs.length >= selected.length) break;
  }
  console.log();

  const byDef = Object.fromEntries(runs.map((r) => [r.test_case_definition_id, r]));
  const results = selected.map((sc) => {
    const r = byDef[known[sc.id]] || {};
    return { id: sc.id, name: sc.name, status: r.status || "missing", result_explanation: r.result_explanation || "", criteria: sc.criteria.map(fill), transcript: transcriptLines(r.transcript_snapshot), test_case_job_id: r.test_case_job_id };
  });
  writeFileSync(RESULTS, JSON.stringify({ engine, batchId, ran_at: new Date().toISOString(), results }, null, 2) + "\n");
  render(results, engine);
  for (const r of results) console.log(`  ${r.status.toUpperCase().padEnd(7)} ${r.id}. ${r.name}${r.status !== "pass" && r.result_explanation ? `\n          ${r.result_explanation.slice(0, 300)}` : ""}`);
  console.log(`\n${results.filter((r) => r.status === "pass").length}/${results.length} passed. Report: ${REPORT}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
