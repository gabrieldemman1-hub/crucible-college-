# Delivery plan: one engineer builds, one consultant checks

How the firm gets the production system in `PLAN-v2.md` built by an AI engineer, with an
independent consultant who works alongside them and verifies the work, so that no phase is
accepted on one person's word.

Status: draft for the firm to review, 2026-09-21. Technical scope is in `PLAN-v2.md`; this
document covers people, ownership, cadence, evidence, and money.

---

## 1. The principle

Every claim of progress is backed by something the firm or the consultant can check without
trusting the engineer: a test call the consultant placed, a Salesforce record the firm can open,
a pull request the consultant read, a checklist with call ids next to each line. The engineer
builds; the consultant verifies; the firm decides. The consultant collaborates on design and helps
unblock the engineer, but never grades their own work.

Three structural rules make this hold:

1. **The firm owns everything.** GitHub organization, Retell account, Salesforce connected app,
   hosting project, database, domain, and the password vault. The engineer and consultant are
   invited as members and can be removed in a minute. Nothing lives in a personal account.
2. **Everything is in the repository.** Code, prompts, routing config, the Retell agent
   definition (published by script, as the proof of concept already does), runbooks, test
   evidence. If it only exists in a dashboard or someone's laptop, it does not count as done.
3. **Two people on every production change.** The main branch is protected. Every change is a
   pull request that the consultant reviews and approves before merge. The engineer cannot
   merge their own work. The same applies to the Retell agent: it is published from the merged
   repo state, not edited live.

## 2. Roles

### The firm (Gabriel, plus named staff)

- Decides scope, priorities, and what "good enough" means at each gate.
- Owns every account and pays every vendor directly. Adds and removes people.
- Provides the routing list, staff numbers, business hours, and Salesforce field decisions.
- Runs the staff acceptance test at each gate (intake managers and admin place and receive real
  calls) and signs the gate.
- Keeps its own Claude Code access to the repository so it can ask, independently of both
  contractors, "what changed this week and why" and "show me where the transcript is stored".

Time: about two hours a week during the build, half a day at each gate.

### The AI engineer (builder)

- Owns delivery of phases 1 to 4 in `PLAN-v2.md`: the Retell conversation flow and transfer
  chain, the intake service, the Salesforce integration, the Nextiva cutover, the runbook.
- Works only through pull requests against the firm's repository, with a written description of
  what changed and how it was tested.
- Posts a short written status at the end of each week (done, next, blocked, risks) in the
  repository, not in chat.
- Hands over at the end: runbook, admin walkthrough recorded on video, and a session where the
  consultant operates the system without the engineer's help.

Skills to hire for: Node or TypeScript services with webhooks; a voice AI platform (Retell
ideally, or Vapi, Bland, ElevenLabs Agents); Salesforce REST API and OAuth; telephony basics
(E.164, SIP or forwarding, caller id). Comfortable being reviewed.

Time: roughly 19 to 24 working days across five to six weeks (from `PLAN-v2.md` section 13),
then a few hours a week of support for the first month after cutover.

### The consultant (reviewer and second pair of hands)

- Reviews the design before each phase starts and every pull request before it merges.
  Approval means "I read it, I understand it, and I checked the claim in the description".
- Independently tests: places their own calls against the scenario list, opens the Salesforce
  records, tries to break the transfer chain, reads transcripts for legal-information leaks.
- Verifies the things the firm cannot see for itself: no audio recording is stored, secrets are
  only in the vault, the webhook signature check is real, credentials are scoped correctly.
- Advises the engineer on Retell and telephony quirks and helps unblock. Pairing is fine;
  writing large parts of the production code is not, because then nobody is checking it.
- Signs each gate with a short written report: what they verified, how, and what they did not
  verify.
- Can operate the system after handover. This is the firm's insurance against the engineer
  becoming unavailable.

Skills to hire for: the same stack as the engineer, plus experience shipping a voice agent to
production and reviewing other people's code. A different person or company from the engineer,
paid separately by the firm, with no revenue tie to the engineer.

Time: about a quarter of the engineer's time, roughly 5 to 7 days spread over the build, front-
loaded at the design review and each gate.

### Counsel

Reviews `prompts/disclosure.md`, the retention position, and the bot-disclosure wording once
before phase 1 and once before cutover. Two short reviews, not ongoing.

## 3. Independence: who must not be whom

- The person who wrote the original proposal should not be the one who reviews the build of it,
  and the builder should not be the one who verifies it. If the firm wants the existing
  consultant involved, they take one role, not both.
- The consultant is not subcontracted through the engineer, and the engineer is not
  subcontracted through the consultant. Two contracts, two invoices, both with the firm.
- Both sign the same confidentiality and IP terms (section 8). Neither gets an account the firm
  does not own.

## 4. Cadence

| When | What | Who | Where it lives |
|---|---|---|---|
| Start of each phase | 45 min design review: engineer presents the approach, consultant challenges it, firm confirms scope | all three | notes as a PR to `docs/decisions/` |
| Continuous | Pull requests: engineer opens, consultant reviews within one business day, merge on approval | engineer, consultant | GitHub |
| Weekly | 30 min status: demo of something working, written status posted first | all three | `docs/status/YYYY-WW.md` |
| Weekly | Consultant's verification note: what they tested this week, findings | consultant | same status file, own section |
| Each gate | Evidence review (section 5), staff test calls, consultant sign-off, firm acceptance | all three plus staff | `docs/gates/phase-N.md` |
| After cutover | Weekly 20-transcript spot check for a month, then monthly | firm or consultant | `docs/spot-checks/` |

Chat is for coordination. Decisions, status, and sign-offs are written in the repository so the
firm can reconstruct what happened without asking anyone.

## 5. Gates and the evidence each one needs

The gates are the ones in `PLAN-v2.md` section 13. This table says what must exist before the
consultant signs and the firm accepts. Payment milestones attach here (section 7).

### Gate 1: callable prototype

| Evidence | Produced by | Verified by |
|---|---|---|
| All 25 scenarios in `tests/scenarios.md` pass, each line with a Retell call id | engineer | consultant re-runs at least 10 of them from their own phone, both languages |
| Warm transfer with whisper works on the real staff numbers, including no-answer and hang-up-during-whisper | engineer | consultant on the receiving end for at least 3 |
| Retell agent published from the repository by script, not hand-edited | engineer | consultant diffs dashboard against repo |
| Audio storage setting confirmed off; transcript-only | engineer | consultant checks the Retell account setting and one call record |
| Disclosure wording as approved by counsel, in both languages | engineer | firm listens to one call each language |
| Median time from answer to transfer under 60 seconds | engineer | consultant computes from call list |

### Gate 2: Salesforce and webhook

| Evidence | Produced by | Verified by |
|---|---|---|
| Every scenario produces the expected sandbox Lead, Note, and Task | engineer | consultant opens the records in the sandbox |
| Phone-based update, not duplicate, when the same caller calls twice | engineer | consultant places both calls |
| Webhook signature check rejects an unsigned request | engineer | consultant sends one |
| Salesforce credentials revoked mid-test: calls still answered, jobs retry, alert email arrives | engineer | consultant performs the revoke |
| Duplicate webhook delivery creates no duplicate record | engineer | consultant replays one |
| Unit tests run in CI on every pull request | engineer | consultant confirms CI is green and reads what it tests |
| All secrets in the firm's vault, none in the repo or in chat history | engineer | consultant runs a secret scan on the repo history |

### Gate 3: pilot on overflow

| Evidence | Produced by | Verified by |
|---|---|---|
| One week of real overflow calls tracked against the targets in `PLAN-v2.md` section 15 | engineer's report | consultant recomputes from Retell and Salesforce, not from the report |
| Zero transcripts where Maya gave legal information | engineer flags | consultant reads every flagged and 20 unflagged transcripts |
| No unexplained failed Salesforce jobs | engineer | consultant checks the jobs table |
| Staff feedback from each intake manager and admin who received transfers | firm | firm |
| Rollback tested: Nextiva forwarding turned off and back on, timed | engineer | consultant observes |

### Gate 4: full cutover

| Evidence | Produced by | Verified by |
|---|---|---|
| Two business days at 100% agent-answered with no rollback | metrics | consultant recomputes |
| Runbook: how to change a staff number, take someone off the list, pause the agent, roll back, rotate a key | engineer | consultant performs each step from the runbook alone |
| Inbound-silence alert fires when the number goes quiet | engineer | consultant simulates |
| Handover session: consultant operates the system for a day without the engineer | both | firm |
| Recorded admin walkthrough for the firm | engineer | firm |

A gate does not pass on a promise to fix something later. Either the item is fixed or the firm
writes down that it accepts the gap and why.

## 6. Hiring

### Sequence

The two-month target (section 12) leaves two weeks for hiring, so both roles are posted at once.

1. Post both roles the same day. Screen the consultant applications first; a consultant who is
   in place by the end of week one reviews the engineer test tasks. If not, the firm judges the
   test tasks with the criteria in `docs/hiring/test-task.md` and the consultant re-reads the
   winning submission on day one.
2. Hire the engineer with the paid test task. Two candidates, one afternoon each.
3. Both start with the phase 1 design review on the engineer's first day.

### Paid test task for engineer candidates (half a day, paid)

Give them this repository's `voice-intake-agent/poc/` folder and a throwaway Retell account.
Ask them to add one thing: a third transfer target with a different whisper, published by the
script, with one scenario added to `tests/scenarios.md` and demonstrated on a call. Judge the
pull request: is the change small and clear, did they test it, did they write down what they
found about Retell's behavior, did they keep secrets out of the repo. Two candidates, one
afternoon each, tells the firm more than any interview.

### Where to find them

The firm has hired engineers on Upwork before, so that is the default. Paste-ready posts and
the test task are in `docs/hiring/`: `upwork-consultant.md` (post first), `upwork-engineer.md`,
and `test-task.md`. Also worth a look: Retell's partner directory, and referrals from other
firms that have deployed a voice agent. For the consultant, prefer someone who has shipped a
voice agent at a firm of similar size and will show a reference.

### Questions that separate candidates

- "Show me a warm transfer with a whisper you built. What broke?"
- "How would you make sure no audio is ever stored?"
- "The Salesforce credentials expire at 2 a.m. What happens to the 3 a.m. calls?"
- "What would you need from us before you could estimate this?"
- For the consultant: "Describe a time you rejected a contractor's work. What was the evidence?"

## 7. Money

The firm's budget is $35 an hour for both roles, hiring from Pakistan and comparable markets.
That is a strong senior rate there, so the firm can be selective. Effort is from `PLAN-v2.md`.

| Item | Basis | Amount |
|---|---|---|
| Engineer build | 22 days at 8 hours, fixed price, paid at gates 20 / 30 / 30 / 20 percent | $6,200 |
| Engineer contingency | 20%, released only for extra scope the firm agrees in writing | up to $1,240 |
| Engineer support after cutover | up to 12 hours over four weeks | up to $420 |
| Consultant review | 5 to 7 days hourly, weekly cap 10 hours | $1,400 to $1,960 |
| Consultant gate reports | 4 signed reports at $175 | $700 |
| Consultant after cutover | about 2 hours a week for a month | about $280 |
| Test tasks | 2 candidates at $150 | $300 |
| Counsel | 2 short reviews | as billed |
| **People total** | | **about $10,500 to $11,100** plus counsel |
| Vendors (Retell, number, hosting, Postgres, email) | ongoing, per `PLAN-v2.md` section 16 | about $1,100 to $1,700 a month |

Paying the engineer on gates and the consultant on hours keeps their incentives apart: the
engineer wants gates to pass, the consultant is paid the same whether they pass or not.

### Working across time zones

Pakistan is 12 hours ahead of California in summer, 13 in winter. One fixed weekly call at
8 a.m. Pacific is 8 or 9 p.m. there, which is workable for both. Everything else is written and
asynchronous by design. Test calls to the Retell number from abroad work through Retell's
dashboard web call or a VoIP app with a US number; the transfer targets during the build are
staff phones in the US, so the staff dry run and gate calls are scheduled in that same evening
window. Upwork's preferred-location setting on the post does the geographic filtering; the post
text itself does not need to mention countries.

## 8. Contract terms to include for both contractors

- Work made for hire; all code, prompts, configs, and documents belong to the firm.
- Confidentiality covering call transcripts and caller details; contractors do not copy call data
  outside the firm's systems, and delete any local test data at the end.
- All credentials issued by the firm through its vault, never shared in chat or email, revoked
  at the end of the engagement.
- Deliverables and acceptance tied to the gates in section 5.
- Written handover as a deliverable, not an afterthought.
- Availability for a defined support window after cutover (for example four weeks, up to a set
  number of hours).
- Termination on two weeks' notice with a handover obligation.

## 9. Red flags during the build

- Progress reported in demos on the engineer's own account or laptop rather than the firm's.
- Pull requests that bundle many changes, or land without the consultant's approval.
- The consultant's weekly note says "reviewed" without saying what was tested and how.
- Retell agent changes made in the dashboard that are not in the repository.
- "Works on my phone" without call ids the consultant can open.
- Scope creep toward dashboards, queues, or a second vendor before gate 3 (the firm chose a
  lean pilot).
- Secrets appearing in chat, tickets, or commit history.
- Any transcript where Maya answered a legal question, however small, treated as a wording fix
  rather than a stop-the-line issue.

## 10. What is already done, and what the engineer inherits

- `PLAN-v2.md`: the technical plan, decisions, architecture, phases, and gates.
- `config/`: the routing config and its schema, validated.
- `prompts/`: the disclosure and briefing wording for counsel.
- `tests/scenarios.md`: the 25 scripted scenarios the gates use.
- `docs/`: Retell verify list and the firm's checklist.
- `poc/`: a working proof of concept (Retell agent published by script, review page, offline
  checks). The engineer replaces the single-prompt agent with the conversation flow in
  `PLAN-v2.md` section 7 and builds the service in section 8; the prompts, routing rules, and
  scenario list carry over.

The consultant's first task is to review all of the above and write down where they disagree.
That review is the first entry in `docs/decisions/`.

## 11. First two weeks, concretely

There is no fixed go-live date. The firm starts the clock when it posts the roles; weeks below
count from that day.

| When | Action | Owner |
|---|---|---|
| Days 1 to 2 | Post both Upwork roles. Create the firm's GitHub organization, move this repository into it, turn on branch protection. Create the password vault; put the rotated Retell key there. | firm |
| Days 3 to 5 | Screen applications. Shortlist two engineers and two consultants. Send the engineer test task to both engineers. | firm |
| Day 8 | Consultant chosen and contracted; they start reading `PLAN-v2.md` and this document. | firm |
| Days 9 to 10 | Test task submissions due; consultant (or firm) ranks them. | consultant |
| Days 11 to 12 | Engineer interviews with the consultant present; contract signed; accounts issued from the vault. Counsel review of `prompts/disclosure.md` booked for the engineer's first week. Salesforce sandbox and Nextiva admin access confirmed. | firm |
| Day 15 | Engineer starts. Phase 1 design review. | all three |

## 12. Schedule, by week

No target date is set. From the day the roles are posted, the plan below takes about nine weeks,
including one week of slack. Durations are from `PLAN-v2.md` section 13. The pilot week has to
see a full, normal week of real calls.

| Week | Phase | What happens | Gate |
|---|---|---|---|
| 1 | Hiring | Both roles posted; accounts, vault, repo set up; proof of concept demoed to the consultant candidates if useful | |
| 2 | Hiring | Consultant starts; test tasks judged; engineer contracted; counsel review booked; staff list, hours, and Salesforce field decisions written down | |
| 3 | Phase 0 and 1 | Design review. Retell account items verified, routing file filled, Nextiva caller-id and forwarding confirmed. Conversation flow and transfer chain built. | |
| 4 | Phase 1 | Transfer testing on real staff numbers, both languages; scenario run; Spanish speaker review. | Gate 1 midweek |
| 5 | Phase 2 | Service, webhooks, Salesforce sandbox, store-and-forward, alerts; end-to-end scenarios. | Gate 2 end of week |
| 6 | Phase 3 setup | Production Salesforce, real staff numbers, staff dry run, Nextiva forward-when-unanswered on. | |
| 7 | Pilot week | Overflow calls answered by Maya; daily transcript and Salesforce review; tuning. | Gate 3 start of week 8 |
| 8 | Phase 4 | Nextiva forward-always; monitoring and alerts; rollback drill; two business days at 100%; runbook handover. | Gate 4 end of week |
| 9 | Slack | Fixes from the first week live; consultant operates alone for a day; recorded walkthrough. | |

### What sets the pace

- **When the engineer starts.** The build weeks count from the engineer's first day. Post both
  roles at the same time, not one after the other.
- **The firm's own inputs before the engineer starts:** staff list with direct numbers and
  languages, overnight person, business hours, Salesforce sandbox access, Nextiva admin access,
  counsel booked. These are `docs/firm-checklist.md`; none of them can be done by the contractors.
- **Counsel sign-off on the disclosure wording before the pilot week.** The pilot cannot answer
  real callers without it.
- **Salesforce sandbox by week 5.** Phase 2 cannot start against production.
- **Retell surprises in phase 1.** The proof of concept lists what only live calls can settle.
  The slack week and the contingency budget exist for this. If phase 1 slips more than three
  days, the consultant and firm decide whether to drop the Spanish whisper variant or the
  overnight substitution from v1 rather than move the pilot week.
- **The pilot week needs a normal week.** Do not schedule it over a holiday or a week when
  half the intake team is out.

If hiring takes longer, every week shifts by the same amount; nothing else in the plan depends on a calendar date.
