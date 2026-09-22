# AI Voice Intake Agent: Project Plan v2

**Supersedes:** `PLAN.md` (v1). Sections of v1 that still apply are referenced rather than repeated.
**Status:** Approved by the firm's project owner. Phase 0 in progress.
**Voice platform:** Retell AI (changed from ElevenLabs in v1, see "Default decisions").

---

## 1. Context

The firm is a California employment law practice on Nextiva (phones) and Salesforce (CRM). About 25% of inbound calls are missed by human intake assistants. Each missed call is a potential case lost.

The goal is a virtual receptionist that answers every call 24/7, in English or Spanish, captures the caller's name and phone number, logs a Lead in Salesforce, and warm-transfers the caller to the right intake manager or admin. It does not run the intake. It gets the caller to the person who does, and it never loses the caller's details.

v1 of this plan was written before the firm shared three documents from a consultant (Malik Zulqurnain): an implementation plan, a proposal, and an access and credentials list. This version reviews those documents, records the decisions made with the firm since, and sets the build approach.

---

## 2. Consultant documents: review

### 2.1 What the consultant proposes

- **Stack:** Nextiva → SIP provider (Cloudonix or Twilio) → Retell AI → n8n or Node.js → Salesforce → Postgres or Firebase → custom admin dashboard and analytics dashboard.
- **Call flow:** AI answers instantly, identifies itself as AI, auto-detects English or Spanish, classifies caller as new, existing, or other matter, collects full name and phone with read-back, then routes.
- **Routing:** weighted distribution across intake managers, 2 to 3 transfer retries, an exception "Walter / Peg / Anthony → Intake Assistant", extension-based routing via a directory, admin pool with no priority.
- **Queue and callback:** if nobody answers, the caller holds. At 30 seconds the AI collects company name, employment dates, and job title. At 2 to 3 minutes it offers a callback that preserves queue position. Final fallback is Nextiva voicemail.
- **Salesforce:** match by phone, update or create Lead. Fields: name, phone, caller type, language, assigned staff, disposition, transcript. Seven dispositions. Timestamped notes, newest first.
- **Admin control panel:** greeting, after-hours message, queue and callback toggles, language default, routing priority and weights, staff enable/disable, after-hours toggle, master kill switch.
- **Analytics dashboard:** calls, transfers, queue entries, callbacks, duration, abandonment, peak times.
- **Compliance:** AI self-identification, no legal advice, one question at a time, phone confirmation, out-of-scope handling, no call recording, PII stored only in Salesforce.
- **Failure handling:** Salesforce down → cache and sync; AI down → reroute to backup number; transfer fail → retry → queue → voicemail; silent caller → re-prompt, timeout, log; call drop → partial lead, abandoned, alert.
- **Timeline:** 9 to 10 weeks: core voice (weeks 1–2), Salesforce (3–5), routing and queue (6–8), dashboards and go-live (9–10).

### 2.2 Where it differs from what the firm wants

| Topic | Firm | Consultant | Resolution |
|---|---|---|---|
| Fields captured | Name and phone (email was considered and dropped) | Name and phone | Agree |
| Transfer type | Warm transfer with a briefing to the manager | Cold transfer with retries | Warm transfer is required |
| No-answer fallback | Message and callback | Hold queue with extra questions, callback with preserved position, voicemail | Message and callback in v1; queue deferred |
| Routing model | Priority list per language | Weights plus priority plus exceptions plus extension directory | Priority list per language; senior-management rule kept |
| Caller types | New or existing | New, existing, other matter | Three types; "other" gets a message and admin transfer |
| Hours | 24/7 with an overnight person | After-hours message and toggle | No after-hours mode; overnight is just a different list |
| Telephony path | Not decided | SIP provider between Nextiva and Retell | Nextiva forwarding for v1; SIP later if needed |
| Admin dashboard | Not requested | Full dashboard plus analytics | Config file in v1; dashboard deferred |
| Backend | Not decided | n8n or Node.js; Postgres or Firebase | Node.js with TypeScript; Postgres |

### 2.3 Concerns with the consultant plan as written

1. **No warm transfer.** The firm requires the agent to brief the intake manager before connecting.
2. **Two undecided pairs** ("n8n or Node.js", "Postgres or Firebase") need to be single choices before build.
3. **A SIP vendor for no pilot benefit.** Nextiva can forward the main number to a Retell number. SIP trunking is a later cost and quality optimization.
4. **Queue position across callbacks is the hardest feature in the plan.** A callback promise plus a Salesforce Task delivers most of the value at a fraction of the complexity.
5. **"PII stored only in Salesforce" is contradicted by the same plan's Postgres logs, cache, and Retell transcripts.** A retention policy is needed.
6. **Dashboards are 20% of the timeline and are not needed to answer calls.**
7. **No cost estimate, success metrics, or acceptance criteria per phase.** No Salesforce edition or Nextiva plan check. No transcription-disclosure wording for California two-party consent.
8. **"Walter / Peg / Anthony → Intake Assistant"** was unexplained. Resolved: they are senior management; callers asking for them go to intake.
9. **Hold-time questions** (company, employment dates, job title) add call time. Resolved: not asked before transfer.

### 2.4 What the consultant plan gets right and this plan keeps

Disposition mapping. Phone-based dedupe with update-not-duplicate. Timestamped notes, newest first. Silent-caller and call-drop handling. Salesforce-down caching with auto-sync. Backup-number reroute if the AI platform is down. Client ownership of all accounts. Sandbox-first Salesforce testing. One question at a time. AI self-identification. No audio recording.

---

## 3. Decisions

### 3.1 Made with the firm

| Question | Decision |
|---|---|
| Who builds | We build it with the firm. Consultant documents are reference input. The firm owns every account. |
| V1 scope | Lean pilot: agent, warm transfer, Salesforce Lead logging, config file for routing. Live on overflow in 3 to 5 weeks. Queue and dashboards deferred. |
| No-answer path | Message and callback. Agent takes a message, promises a callback within one business hour, creates a Salesforce Task, emails the on-shift manager. No hold queue. |
| Transfer type | Warm transfer. Agent dials the manager, briefs them, manager stays on to accept, caller is bridged. |
| Walter, Peg, Anthony | Senior management. A caller asking for any of them goes to the intake manager list, never to them directly. |
| Other-matter callers | Take a message, transfer to admin. Salesforce Task, not a Lead. |
| After hours | No after-hours mode. Same flow 24/7. One overnight intake manager takes new and existing clients (firm decision Sep 22). No admin overnight: other-matter callers get a message and a morning callback. |
| Fields before transfer | Name and phone only (firm decision Sep 22, after the first live calls: asking "what is this regarding" sounded like a form). No reason question, no email. If the caller volunteers a reason it is captured and passed along; it is never asked for. |
| Recording | No audio recording. Text transcript only. |

### 3.2 Default decisions (routine, changeable)

| Topic | Choice | Why |
|---|---|---|
| Voice platform | Retell AI | Matches the consultant documents, native warm transfer with a whisper to the staff member, Spanish support, per-agent storage controls. ElevenLabs is the fallback if week-one test calls disappoint. |
| Telephony for pilot | Nextiva forwards to a Retell-provisioned number | No new vendor. Rollback is one Nextiva setting. |
| Backend | Node.js with TypeScript, one small service | Testable, versioned, no hosted editor to secure. |
| Database | Postgres, for call events and store-and-forward | One choice instead of two. |
| Routing config | JSON file, schema-validated, hot-reloaded | Replaces the dashboard for v1. |
| Alerts | Email (SendGrid or SMTP) | The consultant's access list already assumes email. |
| Agent name and voice | "Maya", warm neutral voice, same persona in both languages | Placeholder until the firm chooses. |

### 3.3 Still to confirm with the firm

Nextiva plan tier. Salesforce edition. Whether a Retell account or consultant work already exists. Intake manager priority list with direct numbers and languages. Overnight person. Admin team numbers. Agent name and voice. Counsel sign-off on `prompts/disclosure.md`. See `docs/firm-checklist.md`.

---

## 4. Architecture

```
Caller
  → Nextiva main number
  → forward (pilot: on no-answer after 3 rings; cutover: forward-always or sequential ring)
  → Retell phone number
  → Retell agent (Conversation Flow, language auto-detect EN/ES)
       call start:  Retell inbound webhook → intake service returns routing slots as dynamic variables
       in call:     greet + disclose → classify → name → phone → reason → hold → warm transfer chain
       after call:  Retell post-call webhook (call_ended, call_analyzed) → intake service
  → Intake service (Node.js, TypeScript; Railway or Render; managed Postgres)
  → Salesforce REST API: Lead upsert by phone, Note (transcript), Task (callback), email alert

Warm transfer leg:
  Retell agent → dials staff direct number (over the public phone network)
  → whisper briefing to staff → staff stays on = accept → caller bridged, agent drops
  → staff hangs up, voicemail, or 25 s timeout = failed → next slot → ... → fallback message
```

### 4.1 Key design choices

- **Conversation Flow, not a single prompt.** The call is a fixed script. Flow nodes make "one question at a time" and "always disclose first" structural. The retry across the priority list is a chain of Call Transfer nodes joined by "transfer failed" edges. If the flow proves too rigid in phase 1, the fallback is a Retell multi-prompt agent with the same tools.
- **Routing injected at call start.** The Retell inbound webhook calls the service, which returns the ordered lists as dynamic variables: up to 3 slots each for intake EN, intake ES, and admin. Nothing is fetched mid-call. If the service is down, the agent's default variables point at the admin list, so a service outage degrades to "everything goes to admin", never a dead call. Overnight substitution happens here, so the flow has no after-hours branch.
- **Warm transfer per slot.** Dial, 25 second timeout, voicemail detection on, whisper from `prompts/briefing.md`. Staff staying on the line is acceptance; hanging up is a decline. Exhausted chain goes to the fallback message. The service then creates the Task and sends the alert.
- **Senior management rule.** The config schema rejects any staff entry whose name matches a `seniorManagement` entry. A caller asking for one of them is classified normally but routed to the intake list.
- **Post-call, store-and-forward Salesforce writes.** Payload lands in Postgres first; a worker applies it to Salesforce with backoff for up to 24 hours. Idempotent by Retell call id. SOSL phone search matches existing records in any format. Lead owner is the staff member who accepted the transfer, else a queue.
- **Audio retention off.** If Retell cannot keep transcripts while discarding audio, use "basic attributes only" and treat Postgres plus the Salesforce Note as the transcript of record. Confirm with Retell in phase 0 and put the position in front of counsel.
- **No dashboard in v1.** Routing is a JSON file. Kill switch is the Nextiva forwarding setting, a one-minute rollback.

---

## 5. Call flow

1. **Greeting and disclosure.** Bilingual opener. Detect language from the caller's first words; if unclear, ask. Then, in the caller's language, the disclosure from `prompts/disclosure.md`: virtual assistant, call is transcribed not recorded, will take a few details and connect them.
2. **Classify.** "Are you a new client, or do you already have a case with us?" Outcomes: new, existing, other matter (vendor, opposing counsel, court, wrong number), or asked for senior management by name.
3. **Collect (new client).** Full name. Best phone number, offering the caller id number as the default, otherwise read back in groups of three, three, four. One sentence on why they are calling. No probing, no evaluation, no legal information.
4. **Collect (existing client).** Name, callback number, one-line reason.
5. **Collect (other matter).** Who they are, organization, callback number, message.
6. **Hold message.** "Please hold while I connect you with {first name}. This may take a moment."
7. **Warm transfer chain.** Intake list for the caller's language (new client or senior-management ask), admin list (existing client or other matter). Up to three slots.
8. **Fallback.** "I'm sorry, everyone is helping other clients right now. I have your details and someone will call you back {within one business hour | first thing in the morning}. Is there anything else you'd like me to pass along?" End call.

Edge cases: silence → one re-prompt, hang up at 10 seconds, log as spam, no Lead. Call drop → partial Lead if a phone number was captured, disposition abandoned. Third language → continue in English, capture number, take message, admin list. Caller demands a human → capture number, go straight to the chain. Distressed caller → one sentence of acknowledgement, then continue. Robocall → hang up, spam.

Guardrails (in the global prompt): no legal information, opinions, fees, timelines, or outcomes; never discourage or disqualify; never argue about client status; never transfer to senior management; never repeat the disclosure; one question per turn; two sentences per turn maximum.

---

## 6. Routing config

`config/routing.json`, validated by `config/routing.schema.json`. Example in `config/routing.example.json`.

Keys: `timezone`, `businessHours` (per weekday, or null), `holidays`, `staff` (id → name, number, email, languages, salesforceUserId), `lists` (`intake.en`, `intake.es`, `admin`, `overnight`), `overnight.handlesExistingClients`, `seniorManagement`, `callbackWindow` (business hours and after hours, EN and ES).

Rules enforced by the schema and loader: E.164 numbers, unique numbers, every list entry references a staff id, a staff member on `intake.es` lists `es`, at most 3 per list, no staff name matches a `seniorManagement` entry.

At call start the service resolves the lists for "now": inside business hours, the configured lists; outside, `overnight` fills the intake slots for both languages; with `overnight.handlesExistingClients` true (the firm's choice) existing clients also go to the overnight person, while other-matter callers get a message and a morning callback because there is no admin overnight. Unused slots are padded with `"none"` so the flow always has three transfer nodes per list.

---

## 7. Retell agent

| Need | Retell primitive | Status |
|---|---|---|
| Inbound number | Retell-provisioned number bound to the agent; number-level inbound webhook URL | Confirmed |
| Per-call routing | Inbound call webhook; response carries `dynamic_variables` and `metadata` | Confirmed |
| Bilingual STT and TTS | Agent `language: "multi"` with a multilingual voice | Verify exact value and supported voices |
| Field capture | Extract Dynamic Variables node per field | Confirmed; verify variable naming |
| Warm transfer with briefing | Call Transfer node, warm transfer, human detection, `agent_detection_timeout_ms: 25000`, private handoff (whisper) message | Confirmed feature; verify whisper field name, on-timeout action, variable rendering in whisper |
| Accept/decline | Staff stays on = accept; hang-up = fail. Explicit yes/no via "chat with agent first" if stable | Verify |
| Retry across list | Transfer node "transfer failed" edge | Confirmed |
| Silent caller | `reminder_trigger_ms`, `reminder_max_count`, `end_call_after_silence_ms` | Confirmed; verify minimums |
| No audio retention | Data storage setting: everything, everything except PII, basic attributes only | Confirmed; no confirmed "transcript only" mode |
| Structured extraction | `post_call_analysis_data`, delivered on `call_analyzed` | Confirmed |
| Post-call webhook | Agent `webhook_url`; `X-Retell-Signature`; SDK `Retell.verify` | Confirmed |
| Simulation tests | Simulation test cases with success criteria, batch runs | Confirmed |

Post-call analysis fields: `caller_type` (new_client, existing_client, other), `language` (en, es, unknown), `caller_full_name`, `callback_phone`, `reason`, `asked_for_senior_management`, `message_taken`, `is_spam_or_silent`, `legal_information_given` (QA flag, must always be false).

Flow node list: `greet_disclose`, `classify`, `collect_name`, `collect_phone`, `collect_reason`, `hold_message`, `transfer_intake_en_1..3`, `transfer_intake_es_1..3`, `transfer_admin_1..3`, `take_message`, `fallback_message`, `end_call`. Language split after `collect_reason` picks the EN or ES intake chain.

Retell items to verify before build are listed in `docs/retell-setup.md`.

---

## 8. Intake service

Stack: Node 20, TypeScript, Express, `retell-sdk` (signature verification and publish script), `pg`, `zod`, `pino`, `libphonenumber-js`, `nodemailer` or `@sendgrid/mail`, `vitest`, `supertest`. Salesforce via REST with `fetch`.

### 8.1 Endpoints

| Route | Purpose |
|---|---|
| `GET /health` | `{ ok, routingLoadedAt, routingVersion, dbOk, sfTokenOk, pendingJobs, lastInboundAt }` |
| `POST /retell/inbound` | Inbound call webhook. Resolves routing for now, returns dynamic variables and a routing snapshot id in metadata. Under 500 ms, no Salesforce calls. |
| `POST /retell/webhook` | `call_started` (insert row), `call_ended` (store transcript), `call_analyzed` (derive disposition, build Salesforce plan, enqueue job, send alerts). |

All Retell routes verify `X-Retell-Signature` on the raw body and reject stale timestamps. Respond 200 fast; Salesforce work is off the request path.

### 8.2 Database

Tables: `calls` (call_id primary key, routing_snapshot_id, from/to numbers, timestamps, disconnection_reason, last_event, raw payloads, disposition, accepted_by_staff_id, Salesforce ids, processed_at), `routing_snapshots`, `sf_jobs` (plan, attempts, next_attempt_at, status, one pending job per call). Webhook handlers upsert by call_id and never downgrade `last_event`, so duplicate deliveries are no-ops. A 5-minute sweeper processes calls whose `call_analyzed` never arrived.

### 8.3 Disposition

Derived from the call object, pure and unit-tested:

1. Transfers attempted and which succeeded, from the tool-call log (fallback: node history, then analysis fields).
2. `disconnection_reason` is call transfer → `transferred_successfully`, `existing_client_transferred`, or `other_matter_transferred`; `acceptedBy` is the staff member of the last successful transfer.
3. Else `message_taken` or transfers attempted with none succeeded → `transfer_failed_message_taken`.
4. Else inactivity or machine detected with no name and no phone → `spam`.
5. Else → `abandoned`.

Transfers attempted, none succeeded, caller hung up on hold → `abandoned` but still a Task and an alert, because the caller expected a connection.

### 8.4 Salesforce mapping

| Captured | Salesforce |
|---|---|
| Name | Lead FirstName, LastName (last token; "Unknown Caller" if empty). Company = "Unknown (AI Intake)" (required field) |
| Phone (E.164) | Lead Phone |
| Language | `Preferred_Language__c` picklist: English, Spanish, Unknown |
| Caller type | `Caller_Type__c` picklist: New Client, Existing Client, Other |
| Reason | Lead Description |
| Disposition | `Intake_Transfer_Outcome__c` picklist: Transferred Successfully, Existing Client Transferred, Other Matter Transferred, Transfer Failed - Message Taken, Abandoned, Spam |
| Lead source | LeadSource "Phone - AI Intake" |
| Owner | Accepted staff's Salesforce user id, else the "AI Intake Unassigned" queue |
| Call id | `Retell_Call_Id__c` external id on Lead and Task |
| Transcript | Note on the Lead or Contact, title "AI Intake call {timestamp} ({call id})", body header plus Agent/Caller lines, truncated at 30,000 characters |

Rules: new client → Lead plus Note, Task only on transfer failure. Existing client → search Contact by phone; found → Task and Note on the Contact; not found → Lead with Caller Type "Existing Client". Other matter → no Lead; Task to the first admin, Note body is the message. Spam → nothing in Salesforce. Abandoned → Lead only if a phone number was captured.

Search: SOSL `FIND {phone} IN PHONE FIELDS RETURNING Lead(...WHERE IsConverted = false), Contact(...)`, with a 10-digit retry if empty. Multiple matches → most recently modified, logged.

Auth: OAuth 2.0 client credentials flow against a Connected App run as the integration user. `Sforce-Auto-Assign: false` so assignment rules do not override the owner.

### 8.5 Store-and-forward and alerts

Worker every 20 seconds claims due jobs (`for update skip locked`). Backoff `min(60 s × 2^attempts, 1 h)` with jitter; `failed` after 24 hours with one alert. Degraded alert after 5 consecutive failures (about 30 minutes), rate-limited to one per hour.

Email templates: `fallback` (to the first person on the relevant list plus a CC: name, number, language, caller type, reason, Salesforce link) and `sf_degraded` / `retry_exhausted` (to ops).

### 8.6 Routing loader

Reads `ROUTING_CONFIG_PATH`, validates with zod; exit on invalid at boot, keep last good config on invalid reload and email ops. Hot reload via `fs.watch` plus a 30 second mtime poll. `/health` reports `routingVersion` (sha256 of the file) so the routing owner can confirm a change took effect.

### 8.7 Environment

`PORT`, `DATABASE_URL`, `RETELL_API_KEY`, `RETELL_AGENT_ID`, `ROUTING_CONFIG_PATH`, `SF_LOGIN_URL`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_API_VERSION`, `SF_DEFAULT_QUEUE_ID`, `SENDGRID_API_KEY` or `SMTP_URL`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_CC`, `OPS_EMAIL_TO`, `FIRM_NAME`, `INBOUND_SILENCE_ALERT_MINUTES`, `LOG_LEVEL`.

---

## 9. Salesforce setup (sandbox first, then production)

1. Confirm the edition has API access (Enterprise, or Professional with the API add-on).
2. Custom fields on Lead: `Preferred_Language__c`, `Caller_Type__c`, `Intake_Transfer_Outcome__c`, `Retell_Call_Id__c` (text 64, external id, unique). On Task: `Retell_Call_Id__c`. Add "Phone - AI Intake" to LeadSource.
3. Queue "AI Intake Unassigned" supporting Lead; members are the intake managers.
4. Integration user on a "Salesforce Integration" licence if available.
5. Permission set "AI Intake Integration": Lead create/read/edit, Contact read, Task create/read, Note create/read, field access to the custom fields, API Enabled. If the org uses Enhanced Notes only, `createNote` switches to ContentNote behind the same interface.
6. Connected App: OAuth, client credentials flow enabled, run as the integration user, scope `api`. Consumer key and secret go into the hosting environment. IP relaxation or allow the host's egress IPs.
7. Check Lead assignment and validation rules against the smoke script.
8. Lead page layout: add the three custom fields and the Notes related list sorted newest first.
9. Report "AI Intake Calls" on Lead by LeadSource, grouped by outcome.
10. Verify with `service/scripts/sf-smoke.ts` (search, create Lead, Note, Task, delete).

---

## 10. Nextiva setup

- **Pilot (overflow):** on whatever answers the main number today (user or call group), set Call Forward When Unanswered to the Retell number after 3 rings.
- **Cutover:** Sequential Ring on the main line (Retell first with a 2-ring timeout, then the human ring group) if the plan supports it for an external number. Otherwise Call Forward Always with a documented one-minute manual rollback.
- **Both:** confirm forwarded calls present the original caller's number to Retell. If not, the flow always asks for the number. Save the Retell number in the company directory as "AI Intake Transfer" so staff phones show the name when a warm transfer rings.
- **Retell down:** uptime ping on `/health`; the service emails ops if no `call_started` arrives for 45 minutes inside business hours after go-live; subscribe to the Retell status page.

---

## 11. Compliance and data handling

Not legal advice. The firm's attorneys own the final call on every item.

- **Two-party consent (Cal. Penal Code 632).** Transcription is disclosed at the start of every call, in the caller's language, before any question. Wording in `prompts/disclosure.md`.
- **AI disclosure.** The greeting identifies Maya as a virtual assistant. Counsel to confirm the wording satisfies California's bot disclosure law.
- **No audio retention.** Retell storage set to the most restrictive mode that still lets the post-call webhook deliver a transcript. If that means "basic attributes only", the transcript of record is Postgres plus the Salesforce Note. Transient audio at Retell during processing is disclosed to counsel.
- **No legal advice.** Hard guardrail plus a post-call QA flag reviewed weekly.
- **Confidentiality.** One-sentence reason only. Transcripts live in Salesforce under the firm's access controls. PII never at info log level. Review Retell's data processing terms; enterprise DPA if the firm requires it.

---

## 12. Testing

### 12.1 Unit tests (`service/test`)

Routing (hours, overnight, holidays, padding, schema rejections, hot reload keeps last good), phone normalization and name split, disposition on captured fixtures for every outcome, Salesforce mapping, apply logic against an in-memory stub (create vs update, partial-failure resume without duplicates), webhook signature and idempotency, worker backoff and expiry.

### 12.2 Scripted scenarios

`tests/scenarios.md`: 25 scenarios run in English and Spanish against the Retell number with three test phones (answers, rings out, voicemail). Each has pass criteria on disclosure, classification, captured fields, list and slot order, whisper content, Salesforce record and disposition, no legal information, and pre-transfer time.

### 12.3 Retell simulations

The conversational scenarios (cooperative caller, deflection, senior management, other matter, language switch, distressed caller, demands a human, third language) as simulation test cases with success criteria. Run the batch before every publish.

### 12.4 End-to-end and staff dry run

`npm run e2e:check -- --call <id>` compares the Retell call, the service row, and the Salesforce record against the scenario's expected values. Before pilot, every intake manager and admin takes two warm transfers: one accept, one decline.

---

## 13. Phases and steps

One developer, 19 to 24 working days, 3 to 5 calendar weeks. Each phase ends with a verification gate.

### Phase 0: alignment (2 days, parallel with the firm)
1. Firm creates the Retell account and buys one number, creates the hosting project and Postgres, invites the developer. All firm-owned.
2. Firm names the routing owner, Salesforce admin, Nextiva admin. Staff numbers, languages, emails, Salesforce user ids go into `config/routing.json`.
3. Verify the Retell items in `docs/retell-setup.md` with docs and support.
4. Counsel reviews `prompts/disclosure.md` and the retention position.
5. Nextiva: confirm caller id passthrough and Sequential Ring availability.
**Gate:** every verify item answered; `routing.json` validates.

### Phase 1: callable prototype (6 days)
6. Scaffold the service: env, logging, health, routing schema, loader, resolve, variables, unit tests.
7. Inbound webhook endpoint. Deploy. Bind to the Retell number.
8. Build the conversation flow: greeting and disclosure, classify, three collection nodes, hold, one transfer node, fallback, end. Export to `agent/conversation-flow.json`; write `agent/publish.ts`.
9. Transfer chain: six intake and three admin transfer nodes with whisper, 25 s timeout, human detection. Test with three test numbers, both languages. Budget a full day for transfer quirks.
10. Silence handling, max duration, post-call analysis fields, default dynamic variables.
11. Run scenarios with the service only logging payloads; capture fixtures. Native Spanish speaker reviews voice and wording. Decide: keep flow or switch to multi-prompt.
**Gate:** all scenarios pass on classification, capture, routing, and whisper; median pre-transfer time under 60 seconds.

### Phase 2: Salesforce and webhook (6 days)
12. Salesforce sandbox per section 9; smoke script passes.
13. Post-call webhook with signature verification, calls table, idempotency, sweeper.
14. Disposition and mapping modules with unit tests on fixtures.
15. Salesforce client, apply module, in-memory stub, tests.
16. Store-and-forward worker and email alerts.
17. End-to-end scenarios against sandbox with `e2e:check`.
**Gate:** every scenario produces the expected sandbox record; revoke credentials mid-test and confirm retry plus alert; duplicate-deliver a webhook and confirm no duplicates.

### Phase 3: pilot on overflow (4 days plus one week monitoring)
18. Production Salesforce setup, production env, audio retention flipped, real staff numbers.
19. Staff dry run.
20. Nextiva: Call Forward When Unanswered after 3 rings. Directory entry for the Retell number.
21. Daily transcript and Salesforce review for one week; tune; simulation batch before each publish.
**Gate:** one week of overflow calls tracked against the targets in section 15; zero legal-information flags; no unexplained failed jobs.

### Phase 4: full cutover (2 days)
22. Nextiva: Sequential Ring or Call Forward Always. Document the rollback.
23. Inbound-silence alert, uptime ping, ops email confirmed.
24. Runbook handover; weekly 20-transcript spot check scheduled.
**Gate:** two business days at 100% agent-answered with no rollback; a timed rollback drill.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Retell warm-transfer edge cases (early voicemail classification, silent bridging, whisper before the human answers), reported by users in 2026 | Full day of transfer testing in phase 1; max call duration cap; the service creates a Task plus alert whenever transfers were attempted and none succeeded, even if the caller dropped |
| Bilingual speech recognition for names and phone numbers | Native speaker test; boosted keywords; three-three-four read-back; caller id offered as default so most callers never dictate a number |
| Caller id not passed through Nextiva forwarding | Test on day one; if it fails, always ask for the number |
| Inbound webhook down leaves the agent without routing | Default dynamic variables point at the admin list |
| "Who accepted" derived from the tool-call log is fragile | Fallback order: tool-call log, node history, analysis field; unknown means queue owner |
| No transcript-without-audio storage mode at Retell | Basic-attributes-only plus our own transcript store; counsel informed |
| Salesforce assignment or validation rules override API writes | Auto-assign header off; sandbox smoke test; errors alert |
| Staff let transfers ring out | Dry run; per-staff acceptance tracked; reorder the list rather than add slots |
| Retell outage at cutover with plain forwarding | Prefer Sequential Ring; inbound-silence alert; one-minute manual rollback |
| Flow JSON drifts between dashboard and repo | `publish.ts` is the only path to production; `flow:diff` before publish |

---

## 15. Success metrics (unchanged from v1)

| Metric | Target |
|---|---|
| Calls answered | 100% within 2 rings, 24/7 |
| Leads with name and phone captured | 90%+ of new-client calls |
| Successful warm transfer during staffed hours | 85%+ |
| Callers who hang up before transfer | Under 10% |
| Salesforce record per completed call | 100% |
| Legal-information QA flag | Zero |

## 16. Cost estimate

Roughly $1,100 to $1,700 per month at 100 calls a day and 4 minutes average: Retell per-minute usage, one phone number, hosting and Postgres, email. Confirm against current Retell pricing before committing. Build effort is in section 13.

## 17. Repository layout

```
voice-intake-agent/
  PLAN.md  PLAN-v2.md  README.md
  config/    routing.example.json  routing.schema.json  (routing.json is not committed with real numbers)
  prompts/   disclosure.md  briefing.md  global-prompt.md
  agent/     agent.json  conversation-flow.json  publish.ts
  service/   src/  test/  scripts/
  tests/     scenarios.md  simulations/  e2e.md
  docs/      retell-setup.md  firm-checklist.md  salesforce-setup.md  nextiva-setup.md  runbook.md
```

Committed in phase 0: this plan, `config/routing.example.json`, `config/routing.schema.json`, `prompts/disclosure.md`, `prompts/briefing.md`, `tests/scenarios.md`, `docs/retell-setup.md`, `docs/firm-checklist.md`. Everything else is built in phases 1 to 4.
