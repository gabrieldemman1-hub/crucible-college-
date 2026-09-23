# Demo runbook

Twenty minutes with a consultant. One person places calls on speaker, one person holds the "intake" phone, and the review page is open on a laptop.

## Before the meeting

- [ ] `node poc/agent/create-agent.mjs` has run and the number answers.
- [ ] The intake phone and the admin phone are charged, unmuted, and in the room.
- [ ] Retell dashboard open to the agent's call history, for a live transcript.
- [ ] Review page published from the last round of test calls, so there is something to show even if a live call misbehaves.
- [ ] Everyone knows: on the staff phone, questions are fine, but anything else you say (even "no") connects the caller. Hang up to decline.

## Opening line to the consultant

"This is a proof of concept. The phone call, the voice, the conversation, and the transfer are real. The routing list is two phones instead of the team, and Salesforce is previewed on a page instead of written. The point is to agree on what the caller hears and what the intake manager gets."

## Six calls, in order

| # | Who calls and what they say | What to notice | Where it goes |
|---|---|---|---|
| 1 | New client, English. "I got fired after complaining about overtime." Confirm caller id as the number. | Transcript notice before the name. One question at a time. Never asks why they're calling. Hand-off line names the intake person, not the caller. | Intake phone rings; whisper heard; caller bridged. |
| 2 | New client, Spanish. Same story in Spanish. | Maya follows into Spanish without being asked. Same script, same order. | Intake phone; whisper is in English for the staff member. |
| 3 | Existing client. "I already have a case, I want to check on it." | Same short path: name and number. No new-client questions. | Admin phone. |
| 4 | "Can I speak to Walter?" | Maya does not transfer to Walter or give a number. Says intake will make sure he gets the message. | Intake phone; whisper ends with "They asked for Walter by name." |
| 5 | New client who asks "Do I have a case?" and "How much do you charge?" | Both get "That's exactly what our team will go over with you." No legal information. Flow continues. | Intake phone. |
| 6 | New client, and nobody answers the intake phone (let it ring out). | Up to thirty seconds of ringing, then the fallback: "I couldn't reach John just now... they'll call you back within the hour" (8am to 8pm Pacific; "first thing in the morning" otherwise). She asks if there's anything to add and waits for the answer before goodbye. | No transfer. Review page shows a callback Task for John. |

Optional if there is time: silence after the greeting (Maya says "Take your time.", then "Are you still there?", and the call ends on its own if the silence continues); a caller who says "I don't want to talk to a robot" (Maya says "Of course", asks whether they have a case, gives the transcript fact with the number question, and transfers).

## After the calls

```bash
node poc/review/pull-calls.mjs && node poc/review/build-page.mjs
```

Republish the page. Walk the consultant through one call top to bottom: transcript, routing card and its reasons, the briefing, the Salesforce preview with the disposition. Then show call 6 for the failure path.

## Questions the consultant will ask, and the answers

- **Why not a hold queue?** Callers leave in under two minutes with a promise and a Task instead of holding. A queue with preserved position is in the plan for version two if the pilot shows a need.
- **Where does the routing list live in production?** A validated config file the firm edits, with an admin page later. See `PLAN-v2.md` section 6.
- **Is the call recorded?** Maya tells callers it isn't. Today, though, Retell keeps the audio of every call (storage is set to "everything" so the dashboard is useful). Changing the storage setting or Maya's wording is an open firm decision; see `REVIEW-2026-09-23.md`.
- **What if Retell is down?** Nextiva's forwarding rule falls back to the human ring group. Rollback is one setting.
- **What does this cost to run?** Roughly $1,100 to $1,700 a month at 100 calls a day. `PLAN-v2.md` section 16.

## Shutting down

`node poc/agent/create-agent.mjs --unbind` stops the number from reaching Maya. Rotate the API key in the Retell dashboard.


## Talking to Maya during the handoff

When your phone rings on a transfer, you are on a private line with Maya. The caller hears music. Her briefing ends with "Stay on to take it, or hang up and I'll take a message." Then she listens. Try:

- "How angry is he?"
- "What exactly did she say?"
- "Did they ask for anyone?"
- "What did you tell them?"

She answers from the call, in the caller's own words. Anything you say that isn't a question ("okay", "go ahead", even "no" or "I can't take this one") connects the caller; the platform treats it as acceptance. To decline, hang up: she goes back to the caller with the callback message.
