# Scope of work: independent consultant

United Employees Law Group · AI phone receptionist "Maya"

Read this first. It covers why we hired you, what the system does, what you check and how, and
how you are paid. Everything it mentions is in the repository.

## Why we hired you

One engineer builds this system. We are a law firm, not a software company, and we cannot judge
the work ourselves. You are our eyes on the project. You review everything the engineer does,
verify each phase with your own tests, and tell us plainly what works and what does not.

You are paid the same whether a gate passes or fails. The engineer is paid when gates pass.
That separation is deliberate.

## The system in brief

Maya answers every call to the firm, 24/7. She names the firm, says a transcript is kept, and
asks whether the caller has a new matter or an existing case. She takes the caller's name and
callback number and nothing else. New clients go to the intake manager on duty. Existing clients
and everything else go to the admin team.

Before a caller is connected, a staff-side agent briefs the staff member and waits for a clear
yes. If nobody accepts, Maya takes a message and the team gets an email. Every call is logged in
Salesforce. Maya never gives legal information, never says whether someone has a case, and never
turns anyone away.

Details are in `PLAN-v2.md`. How we work together is in `DELIVERY-PLAN.md`.

## Where things stand

- A prototype runs on Retell AI with 56 simulated test scenarios and working callback emails.
- Transfers that need the staff member's yes fail before dialing on live calls. The engineer's
  first task is to fix that or propose another design.
- The prototype is switched off to stop spending. It comes back on in phase 1.
- Salesforce is not connected yet, and the audio storage question is still open with our counsel.

## What you do

1. **Design review, week one.** Read the plan, the prototype, and `REVIEW-2026-09-23.md`. Write
   down where you disagree, as the first entry in `docs/decisions/`.
2. **Help hire the engineer.** Review the paid test-task submissions against
   `docs/hiring/test-task.md`, rank them with two sentences each, and join the interview.
3. **Review every pull request.** Approval means you read it, understood it, and checked the
   claim in its description. Nothing merges without you.
4. **Verify every gate yourself** with the checks in the table below. Then write a one-page
   signed report: what you verified, how, and what you did not.
5. **Watch the money.** During the prototype, automated test runs cost about $230 in two days
   before anyone noticed. Each week, compare the Retell billing page and other vendor bills with
   the spend the engineer reports. Tell us the same day if a test run went over $25 without
   approval, or if a week went over $75.
6. **Prove the handover.** After cutover, run the system for one day from the runbook, without
   the engineer.
7. **Send a weekly note** on what you tested and what you found. "Reviewed" on its own is not a
   note.

## What you check at each gate

| Gate | Your checks |
|---|---|
| 1. Agent and transfers | Your own calls in English and Spanish. Staff accept, decline, no answer, and voicemail. The live agent matches the repository, with no dashboard edits. |
| 2. Service and Salesforce | Open the sandbox record for each scenario. Revoke a credential mid-test and confirm the retry and the alert. Replay a webhook and confirm no duplicate. Scan the repository history for secrets. |
| 3. Pilot week | Sample real transcripts daily. Check the targets below. Confirm no transcript contains legal information. |
| 4. Cutover and handover | Confirm the rollback works. Check two business days at 100%. Run the system alone for a day. |

At every gate, also confirm the audio storage setting matches the firm's decision, and that
vendor spend is within budget.

## Targets the system must meet

| Measure | Target |
|---|---|
| Calls answered | 100%, within two rings, 24/7 |
| New-client calls with name and phone captured | 90% or more |
| Transfers accepted during staffed hours | 85% or more |
| Callers who hang up before a transfer | under 10% |
| Salesforce record per completed call | 100% |
| Transcripts where Maya gave legal information | zero |

## Warning signs to raise with us

- Progress shown on the engineer's own accounts or laptop instead of the firm's.
- Large pull requests that bundle many changes.
- Retell changes made in the dashboard that are not in the repository.
- "Works on my phone" without call ids you can open.
- Work on dashboards, queues, or a second vendor before the pilot. We chose a lean first version.
- Secrets in chat, tickets, or commit history.
- Vendor spend the engineer did not report, or did not get approved.
- Any transcript where Maya answered a legal question, treated as a small wording fix. It is a
  stop-the-line issue.

## What you do not do

- Write production code. If you build it, nobody is checking it.
- Approve your own changes, or anything you have not tested.
- Work with, or for, the engineer we hire outside this contract.

## Time and pay

| Item | Amount |
|---|---|
| Review work | $35 an hour, capped at 10 hours a week, about 5 to 7 days over six weeks |
| Signed gate reports | $175 each, four in total |
| After cutover | about 2 hours a week for a month, at the same rate |

The work is heaviest at the start and at each gate. There is one 30-minute call each week at
8 a.m. Pacific.

## Your first week

1. Accept the repository and vault invitations. Ask for read access to Retell billing.
2. Read `PLAN-v2.md`, `DELIVERY-PLAN.md`, `poc/README.md`, and the prototype review.
3. Write your design review.
4. Review the engineer test tasks, if hiring is still open.

## People

| Role | Name | Contact |
|---|---|---|
| Project owner and decision maker | Gabriel | [email] |
| Intake manager and transfer tester | [name] | [email] |
| Salesforce admin | [name] | [email] |
| Nextiva admin | [name] | [email] |
| Counsel, wording review | [name] | [email] |
| Engineer | [name] | [email] |
