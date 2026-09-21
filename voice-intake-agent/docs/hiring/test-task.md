# Paid test task for engineer candidates

Half a day, fixed price, on a throwaway Retell account we create for the candidate. Judge the
pull request, not the conversation. Two candidates, one afternoon each.

## What the candidate gets

- Read access to this repository's `voice-intake-agent/poc/` folder (or a copy of it in a
  separate private repository, if we do not want to give repo access yet).
- A throwaway Retell account with one phone number and an API key, created by us and deleted
  after the task. Trial minutes cover it.
- Two phone numbers to use as transfer targets (ours, or two of their own).
- `poc/README.md` and `poc/GO-LIVE.md`.

## The task

Add a third transfer target to the proof of concept: a "billing" team member with its own tool
`transfer_to_billing`, its own briefing wording, and the rule that a caller who says they are
calling about an invoice or a payment goes there. Specifically:

1. Add the target to `create-agent.mjs` and the prompt, published by the script, not by hand in
   the dashboard.
2. Add the briefing wording to `prompts/briefing.md` following the existing sections.
3. Add one scenario to `tests/scenarios.md` with pass criteria.
4. Add the routing rule to `poc/review/routing.mjs` with a self-test case, and make the review
   page show it.
5. Place the call, get transferred, and include the Retell call id in the pull request.
6. In the PR description, write down anything about Retell's behavior that was not what the
   README said.

## What we judge

| Signal | What good looks like |
|---|---|
| Size and clarity of the change | Small, in the existing style, no rewrite of things they were not asked to touch |
| Evidence | The call id is real; `--dry-run`, `routing.mjs --selftest`, and `selftest.mjs` pass and they say so |
| Secrets | The API key appears nowhere in the diff or the description |
| Honesty | The PR says what did not work or what they are unsure about |
| Communication | A non-engineer can read the description and know what changed |
| Platform sense | The note about Retell behavior is specific, not generic |

## Setting it up on Upwork

Create a fixed-price contract for the task amount with one milestone, "Test task PR". Release on
submission regardless of quality; the task is paid for the time. Have the consultant review both
submissions and rank them with two sentences each.

## Clean-up

Delete the throwaway Retell account, revoke the candidate's repository access, and rotate any
number that was shared.
