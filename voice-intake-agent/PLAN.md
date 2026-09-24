# AI Voice Intake Agent: Project Plan

> **Superseded.** This is the v1 plan (ElevenLabs, email capture, 4-week estimate). The current plan is [`PLAN-v2.md`](./PLAN-v2.md), written after reviewing the consultant documents and confirming decisions with the firm. Kept for history.

**Client:** California employment law firm
**Goal:** Answer 100% of inbound calls with an AI voice agent that greets the caller like a human receptionist, captures contact details, logs the lead in Salesforce, and warm-transfers the caller to the right person by language and client status.
**Status:** Draft v1, pending answers to the open questions in section 2.

---

## 1. Problem and success criteria

Today, human intake assistants answer inbound calls and roughly 25% of calls are missed. Each missed call is a potential employment case lost to another firm.

The agent replaces the first thirty to ninety seconds of every call. It does not replace the intake managers, who still run the full intake.

Success looks like:

| Metric | Target | How measured |
|---|---|---|
| Calls answered | 100% within 2 rings, 24/7 | Platform call logs |
| Leads with name, phone, email captured | 90%+ of new-client calls | Salesforce report |
| Successful warm transfer | 85%+ during staffed hours | Transfer outcome logged per call |
| Callers who hang up before transfer | Under 10% | Platform call logs |
| Salesforce lead created or updated | 100% of completed calls | Webhook logs vs call logs |
| Caller experience | No increase in complaints; spot-check transcripts weekly | Manual review |

---

## 2. Open questions and working assumptions

Answer these before build starts. Where I have no answer, I am proceeding with the assumption shown, and it can be changed later without rework.

| # | Question | Assumption if unanswered |
|---|---|---|
| 1 | When nobody on the priority list answers a warm transfer, what should happen? | Take a message, tell the caller someone will call back within one business hour, create a Salesforce Task, and text the on-shift intake manager. |
| 2 | Does the overnight person handle existing-client calls too, or only new leads? | Overnight handles new leads only. Existing clients after hours get a message and an admin callback the next morning. |
| 3 | Is the priority list a fixed ranked order, or does it change by shift or day? Who maintains it? | Fixed per language, with a separate overnight entry. Maintained in a config file by one named owner at the firm. |
| 4 | Any Salesforce Lead fields required beyond name, phone, email, language, and call summary? | Lead Source = "Phone - AI Intake". Owner = the intake manager who took the transfer, else a default queue. |
| 5 | Language: auto-detect from the caller's first words, or bilingual greeting and ask? | Short bilingual greeting, then auto-detect, with an explicit ask if confidence is low. |
| 6 | Agent name, voice, and disclosure wording? | Name "Maya", neutral warm female voice, disclosure drafted in section 6 for firm review. |
| 7 | Rough call volume per day and peak hours? | 60 to 120 calls per day, peaks 9am to 12pm and 1pm to 4pm Pacific. Drives cost estimate only. |
| 8 | Nextiva plan tier? (Admin portal, Billing or Account) | Plan supports call forwarding to an external number. SIP trunking unknown. |
| 9 | Salesforce edition? (Setup, Company Information, Organization Edition) | Enterprise or above, so the API is available. |
| 10 | Who is the Salesforce admin who can create an integration user and custom fields? | To be named. This is the only step that needs someone outside the project. |
| 11 | If a caller says they are an existing client but no Salesforce match is found, what then? | Route to admin anyway. Admin sorts it out. Agent never argues with the caller. |
| 12 | Should the agent answer multiple numbers (offices, marketing lines) or just the main line? | Main line only for the pilot. Others can be added by forwarding them to the same agent. |
| 13 | Should the caller get an SMS confirmation after the call ("Thanks, we'll be in touch")? | No for v1. Easy to add later. |
| 14 | If a caller insists on a human immediately and refuses to give details, what should the agent do? | Transfer to the priority list for their language after capturing at least a callback number. |
| 15 | Spam and robocalls: hang up after a set silence, or let them run? | Hang up after 10 seconds of silence or clear robocall patterns, log as spam, do not create a lead. |

Settled decisions from our conversation so far:

- Route by language: Spanish, English, and bilingual staff.
- Phone system stays Nextiva. Every intake manager and admin has a direct-dial number.
- Agent collects name, phone number, email. It does not disqualify anyone.
- Log to Salesforce as a Lead. If the phone number already matches a Lead, update it instead of creating a duplicate.
- Warm transfer: agent briefs the intake manager before bridging the caller.
- New leads go to an intake manager from a priority list. Existing clients go to the admin team, who then route to the right intake manager.
- 24/7 coverage. There is an overnight person.
- No voice recording. A text transcript is kept.

---

## 3. Recommended platform

**ElevenLabs Agents** for the voice layer, with **Claude Sonnet** (latest version ElevenLabs offers) as the language model behind it.

Why ElevenLabs:
- Best-in-class voice quality and Spanish support, which matters for a firm whose callers will judge the agent in the first five seconds.
- Native warm transfer to a phone number with a briefing step.
- Supports disabling audio retention while keeping transcripts, which matches the no-recording requirement.
- Native phone numbers and SIP trunk support, so both Nextiva integration paths are open.
- Post-call webhook with transcript and structured data, which feeds Salesforce.

Alternatives considered:
- **Retell**: comparable, slightly better call-center tooling, slightly weaker Spanish voices. Good fallback if ElevenLabs warm transfer proves unreliable in testing.
- **Vapi**: most flexible, more engineering to maintain. Not needed here.
- **Nextiva's own AI agent**: worth a look because it removes the forwarding step, but it is newer, less controllable, and locks the agent to Nextiva. Recommend evaluating it in week one, but planning on ElevenLabs.

Decision point: at the end of week one, after a test call in both languages, confirm ElevenLabs or switch to Retell. Nothing built by then is platform-specific except the agent config.

---

## 4. Architecture

```
Caller
  |
  v
Nextiva main number
  |  (forward all calls, or forward on no-answer after N seconds for pilot)
  v
ElevenLabs phone number  (or SIP trunk from Nextiva)
  |
  v
ElevenLabs Agent
  - Voice: "Maya"
  - Brain: Claude Sonnet
  - System prompt: bilingual intake script (section 6)
  - Tools:
      lookup_routing(language, client_status, time)  -> who to call, in order
      warm_transfer(number, briefing)                -> ElevenLabs native transfer
      save_lead(name, phone, email, language, status, summary, outcome)
      take_message(text)
  |
  |  post-call webhook (transcript + structured data)
  v
Intake Webhook Service  (small Node service, hosted on Railway/Render/Fly)
  - Verifies webhook signature
  - Normalizes phone number to E.164
  - Salesforce: find Lead by phone -> update, else create
  - Attaches transcript to the Lead as a Note or custom long-text field
  - Creates a Task if a message was taken or transfer failed
  - Sends SMS/Slack alert to on-shift manager on failed transfer
  |
  v
Salesforce (Lead + Task + Note)

Warm transfer leg:
ElevenLabs Agent --dials--> Intake manager direct number (Nextiva, via PSTN)
  agent speaks briefing to manager  ->  manager accepts  ->  caller bridged
```

Key design choices:
- **Routing lives in config, not in the prompt.** A JSON file lists people, numbers, languages, and priority. The agent calls a tool that reads it. The firm can change staffing without touching the agent's script.
- **Salesforce writes happen after the call, from the webhook, not during the call.** This keeps the call fast and means a Salesforce outage never affects a live caller. The only in-call dependency is the routing lookup, which is local and fast.
- **Transfers use direct-dial numbers over the public phone network.** No SIP integration with Nextiva is required for v1. That path stays open if call quality or cost pushes us there.

---

## 5. Call flow

### 5.1 Greeting and disclosure (both languages, under 10 seconds)

1. Bilingual opener: "Thanks for calling [Firm]. Gracias por llamar a [Firm]."
2. Detect language from the caller's first response. If unclear, ask: "Would you prefer English or Spanish? ¿Prefiere inglés o español?"
3. Disclosure in the caller's language: "I'm Maya, the firm's virtual assistant. This call is transcribed for our records, but not recorded. I'll get a few details and connect you with the right person."

### 5.2 New or existing

"Are you a new client, or do you already have a case with us?"

- **Existing client** → collect name and callback number (email optional), a one-line reason for calling, then warm transfer to the admin team priority list. Briefing to admin: "Existing client, [name], calling about [reason]. Callback number [number]."
- **New client** → continue to 5.3.
- **Unclear or refuses to answer** → treat as new client.

### 5.3 Collect details (new client)

Collect in this order, one question at a time, and read each back for confirmation:

1. Full name. Ask for spelling if unclear.
2. Best phone number. Offer the caller ID number as default: "Is the number you're calling from the best one to reach you?"
3. Email address. Read back letter by letter for anything ambiguous. If the caller declines, note "declined" and move on. Never push more than once.
4. One sentence on why they are calling. The agent does not probe, evaluate, or advise. It says: "Thank you. An intake manager will go through the details with you."

Guardrails:
- Never give legal information or opinions, even light triage. If asked "do I have a case?", say the intake manager will discuss that.
- Never quote fees, timelines, or outcomes.
- Never disqualify or discourage a caller.
- If the caller is distressed, acknowledge briefly and move to the transfer faster.

### 5.4 Routing lookup

The agent calls `lookup_routing(language, client_status, now)`. It returns an ordered list of people to try, based on:

- Language: English list, Spanish list, or bilingual staff who appear on both.
- Client status: intake managers for new, admin team for existing.
- Time: business hours list, or overnight list.

### 5.5 Warm transfer

1. Agent tells the caller: "Please hold for a moment while I connect you with [first name]."
2. Agent dials the first number on the list. Ring timeout: 25 seconds.
3. If answered, agent delivers the briefing to the manager: "Hi [manager], I have [caller name] on the line, a new client, speaks [language], calling about [one-line reason]. Callback number [number]. Connecting you now."
4. If the manager accepts, the caller is bridged and the agent drops off.
5. If the manager declines or the call goes to voicemail (detected by ElevenLabs voicemail detection), the agent tries the next number.
6. After the list is exhausted, fall through to 5.6.

### 5.6 Message fallback

"I'm sorry, everyone is helping other clients right now. I have your details, and someone will call you back within [one business hour / first thing in the morning]. Is there anything else you'd like me to pass along?"

Then end the call. The webhook creates a Salesforce Task assigned to the first person on the list and sends an SMS or Slack alert.

### 5.7 After hours

Same flow, but the routing lookup returns the overnight list. If the overnight person does not answer, go to message fallback with "first thing in the morning."

### 5.8 Edge cases

| Situation | Behavior |
|---|---|
| Caller hangs up before giving details | Log call with caller ID and partial transcript. Create lead only if a phone number was captured. |
| Caller asks for a specific attorney or staff member by name | Treat as existing client, transfer to admin. |
| Caller is a vendor, opposing counsel, or court | Take a message, route to admin. No lead created. |
| Robocall or dead air | Hang up after 10 seconds of silence. Log as spam. |
| Caller speaks a third language | Continue in English, collect callback number, take message, route to admin. |
| Caller demands a human right now | Capture callback number, then transfer immediately. |
| Transfer connects but drops mid-briefing | Agent returns to caller, apologizes, tries the next person. |

---

## 6. Agent persona and script

**Name:** Maya (placeholder, firm to confirm)
**Voice:** Warm, unhurried, mid-30s, neutral American English and neutral Latin American Spanish. Same persona in both languages.
**Tone:** Professional receptionist. Short sentences. Never chatty. Never says "as an AI."

**Draft disclosure, English:**
"Hi, I'm Maya, the virtual assistant for [Firm]. This call is transcribed for our records but not recorded. I'll take a few quick details and connect you with the right person."

**Draft disclosure, Spanish:**
"Hola, soy Maya, la asistente virtual de [Firm]. Esta llamada se transcribe para nuestros registros, pero no se graba. Le tomaré unos datos rápidos y le comunicaré con la persona indicada."

The firm's attorneys must review this wording. See section 8.

The full system prompt (English and Spanish, with tool instructions) is a deliverable of phase 2 and will live in `voice-intake-agent/prompts/`.

---

## 7. Integrations

### 7.1 Nextiva

Two paths, in order of preference for v1:

**Path A: Call forwarding (recommended for pilot).**
In the Nextiva admin portal, set the main number to forward to the ElevenLabs phone number. For a soft launch, use "forward on no answer after 15 seconds" so the agent only takes overflow. For full cutover, forward all calls. Rollback is one setting change. Works on every Nextiva plan.

**Path B: SIP trunk.**
Connect Nextiva to ElevenLabs over SIP so calls never leave Nextiva's network and transfers can target extensions instead of public numbers. Better call quality and lower per-minute cost at volume. Requires a Nextiva plan with SIP trunking and a support ticket on both sides. Evaluate after the pilot.

Transfers back to staff use their direct-dial numbers over the public phone network in both paths.

What we need from the firm: Nextiva admin login or a Nextiva admin who can make the forwarding change, and the plan tier.

### 7.2 Salesforce

**Objects touched:** Lead (create or update), Task (callback needed), Note or custom field (transcript).

**Field mapping:**

| Agent captures | Salesforce Lead field |
|---|---|
| Full name | FirstName, LastName |
| Phone (E.164) | Phone |
| Email | Email |
| Language | Custom: Preferred_Language__c (picklist: English, Spanish) |
| Client status | Custom: Caller_Type__c (New, Existing) |
| One-line reason | Description |
| Call summary and transcript | Note attached to Lead, or custom long text Call_Transcript__c |
| Transfer outcome | Custom: Intake_Transfer_Outcome__c (Transferred to [name], Message taken, Hung up) |
| Lead Source | "Phone - AI Intake" |
| Owner | Intake manager who accepted the transfer, else default queue |

**Upsert rule:** search Lead by normalized phone. If found, update the fields above and append the transcript as a new Note. If not found, create. Existing-client calls that match a Contact rather than a Lead get a Task on the Contact instead of a new Lead.

**Access:** an integration user with API access, a Connected App using OAuth client credentials, and permission to read and write Lead, Task, Note, and the custom fields. Requires Enterprise edition or the API add-on on Professional.

**Failure handling:** if Salesforce is down, the webhook retries with backoff for up to 24 hours and alerts the project owner. No call data is lost; the payload is stored before the Salesforce call is attempted.

### 7.3 Alerts

On failed transfer or message taken: SMS via Twilio or a Slack message to an intake channel, containing the caller name, number, language, and reason. Decide which in week one.

---

## 8. Compliance and data handling

I am not a lawyer. The firm's attorneys own the final call on every item here.

- **Two-party consent (California Penal Code 632).** Transcription is arguably a recording of the call's contents. Disclose it at the start of every call, in the caller's language, before collecting anything. The draft wording in section 6 does this.
- **AI disclosure.** California's bot disclosure law (B&P Code 17940 et seq.) requires disclosing that a bot is being used in certain interactions. The greeting identifies Maya as a virtual assistant. Recommend the firm confirm the wording is sufficient.
- **No audio retention.** ElevenLabs has a per-agent setting to disable audio storage. It will be off. Only text transcripts are retained, in ElevenLabs and in Salesforce.
- **No legal advice.** Hard guardrail in the prompt. The agent collects and connects, nothing more.
- **Confidentiality.** Callers may describe sensitive employment facts. The agent asks for one sentence only. Transcripts are stored in Salesforce under the firm's existing access controls. ElevenLabs transcript retention should be set to the shortest window that still allows debugging (30 days suggested).
- **Vendor terms.** Review ElevenLabs' data processing terms for confidentiality and training opt-out. Enterprise plan gives a signed DPA and zero-retention options if the firm requires them.
- **Attorney-client privilege.** Intake calls with a firm are generally privileged. The firm should confirm it is comfortable with a third-party processor (ElevenLabs) handling the transcript, and whether a DPA is required.

---

## 9. Testing plan

### 9.1 Scripted scenarios (before any real caller)

Run each in English and Spanish, by calling the ElevenLabs test number from a cell phone:

1. New client, cooperative, all details given clearly.
2. New client, mumbled email, agent must confirm letter by letter.
3. New client, declines email.
4. Existing client asking about case status.
5. Caller asks "do I have a case?" (agent must deflect, not answer).
6. Caller asks for a specific attorney by name.
7. Caller switches language mid-call.
8. Warm transfer where the first manager doesn't answer and the second does.
9. Warm transfer where nobody answers, message fallback.
10. After-hours call to the overnight person.
11. Caller hangs up after giving name only.
12. Silence and robocall.
13. Distressed caller who talks at length.
14. Caller demands a human immediately.

Each scenario has pass criteria: correct fields captured, correct route chosen, correct Salesforce record, disclosure delivered, no legal information given.

### 9.2 Automated evaluation

ElevenLabs supports simulated conversations and evaluation criteria. We will define the pass criteria above as evaluation rubrics and run them on every prompt change.

### 9.3 Staff dry run

Before pilot, each intake manager and admin receives at least two warm transfers from the agent so they know what the briefing sounds like and how to accept or decline.

---

## 10. Rollout

### Phase 0: Alignment (this week)
- Answer the open questions in section 2.
- Firm names an owner for the routing list and a Salesforce admin.
- Firm reviews the disclosure wording and compliance section with counsel.
- Firm creates an ElevenLabs account and buys one phone number.
- Deliverable: this plan, signed off.

### Phase 1: Agent prototype (week 1)
- Build the routing config and the routing lookup tool.
- Write the bilingual system prompt.
- Configure the ElevenLabs agent: voice, model, tools, audio retention off.
- Test by calling the ElevenLabs number directly. Transfers go to test numbers, not staff.
- Decision point: confirm ElevenLabs or switch to Retell.
- Deliverable: a working agent you can call, in both languages, that collects details and transfers.

### Phase 2: Salesforce and webhook (week 2)
- Build the webhook service with Salesforce stubbed, then wire the real API once the integration user exists.
- Create the custom Lead fields.
- Run the scripted scenarios and confirm Salesforce records.
- Build the alerting for failed transfers.
- Deliverable: end-to-end flow from call to Salesforce Lead.

### Phase 3: Staff dry run and pilot (week 3)
- Load real staff numbers into the routing config.
- Staff dry run per section 9.3.
- Set Nextiva to forward on no-answer after 15 seconds. The agent takes only calls the humans miss.
- Review every transcript daily for the first week. Tune prompt.
- Deliverable: pilot live on overflow, daily transcript review.

### Phase 4: Full cutover (week 4 or 5, based on pilot)
- Switch Nextiva to forward all calls.
- Move to weekly transcript spot-checks.
- Hand over the runbook.
- Deliverable: agent answering 100% of calls, runbook delivered.

**Rollback at any phase:** change the Nextiva forwarding setting back. Takes one minute. Nothing else needs to be undone.

---

## 11. Operations after launch

- **Routing list owner** at the firm updates `routing.json` when staff or shifts change. I'll provide a one-page guide. Changes take effect on the next call.
- **Prompt changes** go through the scenario tests in section 9 before deploy.
- **Weekly review:** 20 random transcripts, checking for missed fields, wrong routes, and any legal information leakage.
- **Monitoring:** dashboard of calls per day, transfer success rate, message fallback rate, Salesforce write failures. Alert if answer rate drops or webhook errors spike.
- **Cost estimate** (assumes 100 calls per day, 4 minutes average):

| Item | Monthly estimate |
|---|---|
| ElevenLabs Agents, 12,000 minutes | $1,000 to $1,500 |
| ElevenLabs phone number and telephony | $50 to $150 |
| Webhook hosting | $10 to $25 |
| SMS alerts | $10 to $30 |
| Salesforce API | Included with edition |
| **Total** | **Roughly $1,100 to $1,700** |

These are list-price estimates as of writing and should be confirmed against current ElevenLabs pricing before committing.

---

## 12. Repository layout (to be built)

```
voice-intake-agent/
  PLAN.md                     this document
  config/
    routing.json              priority lists, numbers, hours, overnight
    routing.schema.json       validation schema
  prompts/
    system.en.md              English system prompt
    system.es.md              Spanish system prompt
    briefing.md               warm transfer briefing templates
  agent/
    elevenlabs-agent.json     importable agent definition
    tools.json                tool definitions for the agent
  webhook/
    src/
      server.ts               receives ElevenLabs post-call webhook
      salesforce.ts           Lead upsert, Task, Note
      routing.ts              lookup_routing implementation
      alerts.ts               SMS or Slack on failed transfer
    test/
      scenarios/              scripted caller transcripts and expected outcomes
  docs/
    runbook.md                how to change routing, review transcripts, roll back
    nextiva-setup.md          forwarding steps with screenshots
    salesforce-setup.md       integration user, custom fields
```

---

## 13. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Warm transfer quality is poor over public phone network | Medium | Test in week 1. Fall back to SIP trunk or cold transfer with screen-pop. |
| Spanish voice sounds unnatural to native speakers | Medium | Have a native-speaking staff member test in week 1. Try multiple voices. |
| Callers hang up when they realize it's AI | Medium | Keep the pre-transfer segment under 90 seconds. Pilot on overflow first and measure hang-up rate. |
| Email capture by voice is error-prone | High | Letter-by-letter read-back. Accept "declined." Intake manager confirms email during full intake anyway. |
| Salesforce edition lacks API | Low | Check in phase 0. API add-on is available for Professional. |
| Staff decline transfers or let them ring out | Medium | Dry run and training. Track per-person acceptance rate in the dashboard. |
| Compliance wording insufficient | Low | Counsel review in phase 0. |
| ElevenLabs outage | Low | Nextiva forwarding rule falls back to a human ring group if the agent number is unreachable. |
