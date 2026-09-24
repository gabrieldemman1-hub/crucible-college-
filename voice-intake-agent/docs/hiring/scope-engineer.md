# Scope of work: AI engineer

United Employees Law Group · AI phone receptionist "Maya"

Read this first. It covers why the project exists, what you will build, what already exists,
the rules we work by, and how you are paid. Everything it mentions is in the repository.

## Why this project exists

We are a fully remote California employment law firm. Our phones run on Nextiva and our client
records are in Salesforce. About one in four inbound calls goes unanswered, and a missed call is
often a lost client. We want every call answered, day and night, and every caller either talking
to a person or on a callback list within minutes.

## What Maya does

1. **Answers every call**, 24 hours a day, with the same flow at all hours.
2. **Greets the caller.** She names the firm, says a transcript of the call is kept, and asks
   whether they are calling about a new matter or an existing case.
3. **Takes two things:** the caller's name and callback number. She never asks why they are
   calling, and asks no screening questions.
4. **Routes the call.** New clients go to the intake manager on duty. Existing clients and
   everything else go to the admin team. Callers who ask for senior management go to intake.
   Overnight, one intake manager takes everyone.
5. **Gets a yes before connecting.** A staff-side agent calls the staff member, tells them who
   is calling, answers their questions, and connects the caller only on a clear yes. A no,
   silence, voicemail, or call screening sends the caller back to Maya.
6. **Takes a message when nobody accepts**, promises a callback, and emails the team.
7. **Logs every call in Salesforce:** a Lead created or updated by phone number, a Note with
   the transcript, and a Task when a callback is owed.
8. **Stays inside the lines.** She never gives legal information, never says whether someone has
   a case, and never turns anyone away. A caller in crisis hears 911 and 988.

She does not do intake. She gets the caller to the person who does, and never loses their details.

## What already exists

| Item | Where | Status |
|---|---|---|
| Prototype agent on Retell | `poc/agent/` | Maya plus two staff-side transfer agents, published by script. |
| Simulated test calls | `poc/tests/` | 56 scenarios with code checks on every transcript. |
| Callback email alerts | `poc/alerts/` | Google Apps Script on Retell's post-call webhook. Working. |
| Technical plan | `PLAN-v2.md` | The spec: architecture, service, Salesforce mapping, phases. |
| Delivery plan | `DELIVERY-PLAN.md` | Roles, gates, evidence, payment. |
| Routing config and schema | `config/` | Staff lists go in `routing.json`, which is never committed. |
| Review of the prototype | `REVIEW-2026-09-23.md` | 69 findings and what was fixed. |

The production build replaces the prototype's single prompt with the conversation flow in
`PLAN-v2.md` section 7, and adds the service in section 8. The wording, routing rules, and
scenarios carry over.

## Known issues you start with

- **Transfers that need a yes fail.** Retell's agentic warm transfer returned "Transfer failed
  due to an error" before dialing, on both live test calls. The configuration checks out and the
  plain warm transfer works. Your first task is to find the cause with Retell support, or to
  propose another design that keeps "staff must say yes".
- **The prototype is switched off.** The phone number is not connected to any agent, to stop
  spending. You reconnect it in phase 1 once we agree.
- **Salesforce is not connected yet.** The prototype only previews the record it would create.
- **Audio storage is still open with our counsel.** Build so the system works with audio
  storage off.

## Phases and gates

You are paid when a gate passes. The consultant verifies each gate independently. The evidence
for each gate is in `DELIVERY-PLAN.md` section 5.

| Phase | You deliver | The gate checks |
|---|---|---|
| 1. Agent and transfers | Conversation flow and transfer chain, published from the repository by script | Scenario calls in English and Spanish with call ids; accept, decline, no answer, and voicemail on real staff phones |
| 2. Service and Salesforce | Node or TypeScript service, webhooks with signature checks, Postgres store-and-forward, Salesforce sandbox, email alerts | Every scenario creates the right sandbox record; a revoked credential retries and alerts; a replayed webhook makes no duplicate |
| 3. Pilot week | Nextiva forwards unanswered calls to Maya; daily review and tuning | A full normal week of real calls, reviewed against the targets below |
| 4. Cutover and handover | Forward all calls, monitoring, rollback drill, runbook, recorded walkthrough | Two business days at 100%; the consultant runs the system alone for a day |

## What done looks like

| Measure | Target |
|---|---|
| Calls answered | 100%, within two rings, 24/7 |
| New-client calls with name and phone captured | 90% or more |
| Transfers accepted during staffed hours | 85% or more |
| Callers who hang up before a transfer | under 10% |
| Salesforce record per completed call | 100% |
| Transcripts where Maya gave legal information | zero |

## Not in scope for version 1

Dashboards, hold queues, a second voice vendor, intake questions, outbound calls, and text
messages. Raise them as ideas, not as work.

## The rules

- **We own everything.** Accounts, repository, and phone numbers belong to the firm. You are
  invited in. Credentials come from our password vault, never through chat, email, or commits.
- **Pull requests only.** The consultant approves before anything merges. Retell changes are
  published by script from the merged repository, never edited in the dashboard.
- **Cost control.** During the prototype, automated test runs cost about $230 in two days before
  anyone noticed. That must not happen again.
  - Put vendor spend in every Friday status.
  - Get written approval before any test run expected to cost more than $25, or any week over
    $75.
  - Run only the scenarios your change affects, unless we approve the full suite.
- **Confidentiality.** Transcripts hold people's legal situations. Do not copy call data outside
  our systems, and delete any local test data when you finish.
- **Stop the line.** Any transcript where Maya gave legal information, however small, stops the
  work until it is fixed and understood.

## Time and pay

| Item | Amount |
|---|---|
| Build, fixed price | $6,200, paid 20 / 30 / 30 / 20 percent at gates 1 to 4 |
| Extra scope | up to $1,240, only for work agreed in writing first |
| Support after cutover | up to 12 hours over four weeks, at $35 an hour |

Expected effort is 19 to 24 working days over five to six weeks. There is one 30-minute call
each week at 8 a.m. Pacific. Every Friday, send a written status: what shipped, what is next,
blockers, and vendor spend.

## Your first week

1. Accept the repository, Retell, and vault invitations.
2. Read `PLAN-v2.md`, `DELIVERY-PLAN.md`, `poc/README.md`, and the prototype review.
3. Investigate the transfer failure. Open a Retell support ticket with the call ids we give you.
4. Present your phase 1 approach at the design review with the consultant: flow structure,
   transfer design, and what you will verify on Retell first.

## People

| Role | Name | Contact |
|---|---|---|
| Project owner and decision maker | Gabriel | [email] |
| Intake manager and transfer tester | [name] | [email] |
| Admin team contact | [name] | [email] |
| Salesforce admin | [name] | [email] |
| Nextiva admin | [name] | [email] |
| Counsel, wording review | [name] | [email] |
| Consultant | [name] | [email] |
