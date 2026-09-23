# Proof of concept: a callable Maya

A real phone number a consultant can dial. Maya answers, talks in English or Spanish, collects the caller's name and phone number (never the reason), and warm-transfers them to a staff phone after whispering a briefing. A private review page shows, for each call, the routing decision, the briefing, and the Salesforce record the real system would create.

## What is real and what is simulated

| Real | Simulated |
|---|---|
| The phone call, the voice, the AI conversation, language detection | Salesforce: records are previewed on the review page, not written to a CRM |
| Warm transfer with the whisper to the staff member | The routing list: two phones stand in for the intake and admin teams |
| Post-call extraction of name, phone, reason, caller type, language | Business hours: taken from `config/routing.example.json` |
| The disclosure wording from `prompts/disclosure.md` | Email alerts and store-and-forward: not present |

Anything in this folder can be thrown away. The production design is `../PLAN-v2.md`.

## What the firm needs before we can run it

1. A Retell AI account under a firm email. Free trial minutes cover the demo. Buying a phone number costs about $2 a month and may need a card.
2. One phone number bought in the Retell dashboard.
3. An API key from the Retell dashboard. Rotate it after the demo.
4. Two phones for transfers: one acts as the intake manager, one as admin. Their numbers and first names.

## Running it

The scripts are plain Node 20 or newer with no dependencies. They talk to `api.retellai.com`, so they must run somewhere that can reach it: a laptop with Node installed, or a Claude Code session whose environment allows that host.

```bash
export RETELL_API_KEY=key_...            # from the Retell dashboard; omit if the environment attaches it as an API credential
export INTAKE_PHONE=+14155550101         # the phone that plays "intake manager" (optional once the agent exists)
export ADMIN_PHONE=+14155550201          # the phone that plays "admin" (optional once the agent exists)
# optional: export RETELL_PHONE_NUMBER=+1...   export VOICE_ID=...   export RETELL_MODEL=claude-5-sonnet
```

The names Maya says (firm, her own name, intake, admin, the office line she gives a caller who refuses
transcription) live in `poc/agent/live.json`, which is committed. Environment variables with the same names
are ignored, with a warning, so an old shell can't rename the firm. Edit `live.json` to change a name.

`poc/agent/.retell-ids.json` is committed too (ids only, no secrets), so every checkout updates the same
agent. If it is missing and the number already answers with another agent, `create-agent.mjs` refuses to
create a second one unless you pass `--new`. When no phone is set in the environment, it keeps the transfer
numbers already on the live agent.

```bash

node poc/agent/preflight.mjs               # read-only: checks the key, the number, and the settings above
node poc/agent/create-agent.mjs --voices   # list candidate voices with preview links, pick one
node poc/agent/create-agent.mjs            # create or update Maya and bind the phone number
```

Step by step for the first live session: `GO-LIVE.md`.

Automated caller tests, no phone needed: `poc/tests/scenarios.json` holds 48 caller personas with pass
criteria; `node poc/tests/run-simulations.mjs` has Retell play each caller against Maya's current version with
transfers mocked (failures return the exact text Retell returns on a real failed transfer), grades the
transcripts, and writes `poc/tests/report.md`. On top of the model grader, every transcript gets code checks:
the transcript notice before the first name or number question, banned phrases, the expected transfer tool,
no caller name in the hand-off line, and the greeting naming the firm. It exits non-zero unless every run
passes. `--only 4,7` runs a subset, `--repeat 3` runs each scenario three times to expose flaky behaviour,
`--prune` deletes stale test definitions on Retell. The simulated caller is `gpt-5.5` unless `SIM_MODEL` says
otherwise.

Checks that need neither a key nor network, run before any change to the prompt or scripts:

```bash
node poc/agent/create-agent.mjs --dry-run  # prints the exact Retell payloads; fails on any unfilled {{placeholder}}
node poc/review/routing.mjs --selftest     # routing rules
node poc/review/selftest.mjs               # review pipeline over awkward call shapes, plus a page render
```

Call the number. After a few test calls:

```bash
node poc/review/pull-calls.mjs             # fetch calls, compute routing + Salesforce preview -> calls.json
node poc/review/build-page.mjs             # render calls.json -> index.html
```

Open `poc/review/index.html` in a browser, or publish it as a private artifact to share by link. To preview the page before any real calls exist, run `pull-calls.mjs --sample` instead; the two example calls are labeled as examples.

To turn Maya off after the demo: `node poc/agent/create-agent.mjs --unbind`. To remove her entirely, delete the agent and the number in the Retell dashboard.

## Settings worth knowing

- `poc/agent/prompt.md` is the whole personality and script. Edit it, re-run `create-agent.mjs`, call again.
- `poc/agent/agent.config.json` holds voice, timing, and the fields extracted after each call.
- Model: `gpt-4.1` by default because it is Retell's most tested for latency. Set `RETELL_MODEL=claude-5-sonnet` to try Claude; both are on Retell's list. Compare on two test calls and keep the one that sounds better.
- Storage is set to "everything" so the Retell dashboard shows transcripts during the demo. That setting also keeps call audio, while Maya says the call is not recorded: an open firm decision (`REVIEW-2026-09-23.md`). Recording links are signed (`opt_in_signed_url`), so they expire instead of being public. Production turns audio off; see `docs/retell-setup.md` item 11.
- Whisper: the briefing is generated by the model from the conversation, following the STEP 1 wording in `create-agent.mjs`. Staff can ask Maya questions first. Anything that isn't a question connects the caller; hanging up is the only way to decline, and Maya then reads the fallback message to the caller.

## Retell API facts these scripts rely on

Taken from `retell-sdk` 6.0.1 type definitions, since the docs site was not reachable from the build environment.

| Item | Value |
|---|---|
| Base URL and auth | `https://api.retellai.com`, `Authorization: Bearer <key>` |
| Create / update LLM | `POST /create-retell-llm`, `PATCH /update-retell-llm/{llm_id}` |
| Create / update agent | `POST /create-agent`, `PATCH /update-agent/{agent_id}` |
| Bind number | `PATCH /update-phone-number/{number}` with `inbound_agents: [{agent_id, weight}]` |
| List numbers, voices | `GET /v2/list-phone-numbers`, `GET /list-voices` |
| List and get calls | `POST /v3/list-calls` (filter_criteria.agent, start_timestamp range), `GET /v2/get-call/{call_id}` |
| Multilingual | agent `language: "multi"` |
| Warm transfer | tool `type: "transfer_call"`, `transfer_option.type: "warm_transfer"`, `private_handoff_option: {type: "prompt", prompt}`, `agent_detection_timeout_ms`, `transfer_ring_duration_ms`, `on_hold_music`, `opt_out_human_detection` |
| Silence | `reminder_trigger_ms`, `reminder_max_count`, `end_call_after_silence_ms` |
| Extraction | agent `post_call_analysis_data` (string, enum, boolean, number); results in `call.call_analysis.custom_analysis_data` |
| Storage | `data_storage_setting`: everything, everything_except_pii, basic_attributes_only |
| Transfer outcome | `disconnection_reason` includes `call_transfer`, `transfer_bridged`, `transfer_cancelled`, `dial_no_answer`, `dial_busy`, `voicemail_reached`; tool results in `transcript_with_tool_calls` |

Still to confirm on the first real run: whether a hang-up during the whisper produces a failed tool result (so Maya reads the fallback), and whether the trial tier allows warm transfer. If not, `transfer_option.type` can be changed to `cold_transfer` in `create-agent.mjs` and Maya will speak the briefing to the caller before transferring.
