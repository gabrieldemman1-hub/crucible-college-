# Project brief for the engineer and the consultant

Read this first. It is the one-page version of the project, what has already been decided, what
already exists, and how we will work. Everything it refers to is in this repository.

## The problem

We are a California employment law firm. Calls come in on Nextiva. About one in four inbound
calls is missed by our human intake assistants, and a missed call is often a lost case. Our CRM
is Salesforce.

## What we are building

A virtual receptionist, working name "Maya", that:

1. Answers every call, day and night, in English or Spanish, within two rings.
2. Says who she is and that the call is transcribed but not recorded.
3. Asks whether the caller is a new client or already has a case with us.
4. Takes three things and nothing more: full name, callback number, one sentence on why they
   are calling. No email, no employer details, no screening questions.
5. Warm-transfers the caller: dials the right staff member, whispers a briefing to them
   privately ("I have Carlos on the line, new client, speaking Spanish, calling about unpaid
   overtime"), and bridges the caller when the staff member stays on the line.
6. If nobody picks up, takes a message, promises a callback, and ends politely.
7. Logs every call in Salesforce: a Lead for new clients (updated, not duplicated, if the phone
   number already exists), a Note with the transcript, a Task for callbacks.

She does not do intake. She gets the caller to the person who does, and never loses their
details.

## Decisions already made (do not reopen without asking)

| Topic | Decision |
|---|---|
| Voice platform | Retell AI. ElevenLabs is the fallback if week-one calls disappoint. |
| Phones | Nextiva keeps the main number and forwards to a Retell number. Pilot: forward when unanswered. Cutover: forward always. Rollback is one Nextiva setting. |
| Routing | A JSON file in the repo, schema-validated: intake list in English, intake list in Spanish, admin list, overnight person. Priority order within each list. Every staff member has a direct number. |
| New client | Goes to the intake list matching their language. |
| Existing client | Goes to the admin team, who route to the case's intake manager themselves. |
| Other matters (vendors, opposing counsel, courts) | Message taken, then transferred to admin. Salesforce Task, not a Lead. |
| Callers asking for Walter, Peg, or Anthony | Senior management. Routed to the intake list, never to them. |
| Hours | No after-hours mode. Same flow 24/7. Overnight the list is the overnight person. |
| No-answer path | Message and callback. No hold queue. |
| Recording | None. Transcript only. Retell storage set accordingly and verified. |
| Legal questions | Maya never answers them, never says whether someone has a case, never disqualifies anyone. |
| Scope of v1 | Lean pilot: agent, warm transfer, Salesforce logging, routing file. No dashboards, no queue, no second vendor. |
| Backend | One small Node/TypeScript service, Postgres for call events and store-and-forward, email alerts. |

Full reasoning is in `PLAN-v2.md` section 3.

## What already exists

| Item | Where | What to do with it |
|---|---|---|
| Technical plan | `PLAN-v2.md` | The spec. Architecture, call flow, service design, Salesforce mapping, phases, gates. |
| Delivery plan | `DELIVERY-PLAN.md` | How we work together: roles, cadence, evidence per gate, payment. |
| Routing config and schema | `config/` | Real staff go in `routing.json` (not committed). Example and schema are there. |
| Disclosure and briefing wording | `prompts/` | Counsel-reviewed text. Change only through a PR with the firm's sign-off. |
| Scenario list | `tests/scenarios.md` | 25 scripted calls with pass criteria. The gates use these. |
| Retell verify list and firm checklist | `docs/` | Items to confirm on the account, and what the firm sets up. |
| Proof of concept | `poc/` | A working single-prompt Retell agent published by script, with a review page. Run `poc/README.md` to see it call. The production build replaces the single prompt with a conversation flow and adds the service; the prompts, rules, and scenarios carry over. |

## What done looks like

| Metric | Target |
|---|---|
| Calls answered | 100% within two rings, 24/7 |
| New-client calls with name and phone captured | 90% or more |
| Successful warm transfer during staffed hours | 85% or more |
| Callers who hang up before transfer | under 10% |
| Salesforce record per completed call | 100% |
| Transcripts where Maya gave legal information | zero |

## How we work

- The firm owns every account and the repository. You are invited in.
- Everything through pull requests. The consultant reviews and approves before anything merges.
  The Retell agent is published from the merged repo by script, never edited live.
- Four phases, four gates, evidence for each in `DELIVERY-PLAN.md` section 5. The engineer is
  paid at gates. The consultant verifies independently and signs each one.
- Written weekly status in the repo, a 30-minute call weekly, a design review at the start of
  each phase.
- Secrets come from the firm's vault only. Never in chat, tickets, or commits.
- Call transcripts contain real people's legal situations. Treat every one as confidential.

## Your first week

**Consultant:** read `PLAN-v2.md`, `DELIVERY-PLAN.md`, and `poc/`. Write down where you disagree
as the first entry in `docs/decisions/`. Help finalize the engineer post and review the test
tasks.

**Engineer:** run the proof of concept on the firm's Retell account per `poc/GO-LIVE.md`. Place
ten calls. Then present your phase 1 approach at the design review: conversation flow structure,
transfer chain, what you will verify about Retell first.

## People

| Role | Who | Reach |
|---|---|---|
| Project owner and decision maker | [name] | [email] |
| Routing owner (staff list, hours) | [name] | [email] |
| Salesforce admin | [name] | [email] |
| Nextiva admin | [name] | [email] |
| Counsel for wording review | [name] | [email] |
| Consultant | [name] | [email] |
| Engineer | [name] | [email] |
