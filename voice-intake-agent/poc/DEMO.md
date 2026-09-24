# Demo runbook

Twenty minutes with a consultant. One person places calls on speaker, one person holds the "intake" phone, and the review page is open on a laptop.

## Before the meeting

- [ ] `node poc/agent/create-agent.mjs` has run and the number answers.
- [ ] The intake phone and the admin phone are charged, unmuted, and in the room.
- [ ] Retell dashboard open to the agent's call history, for a live transcript.
- [ ] Review page published from the last round of test calls, so there is something to show even if a live call misbehaves.
- [ ] Everyone knows: on the staff phone, Maya briefs you and asks "Can you take them?" Ask anything first. Only a clear yes ("yes", "put them through") connects the caller; "no", "not now", or hanging up sends them back to Maya for a message.

## Opening line to the consultant

"This is a proof of concept. The phone call, the voice, the conversation, and the transfer are real. The routing list is two phones instead of the team, and Salesforce is previewed on a page instead of written. The point is to agree on what the caller hears and what the intake manager gets."

## Six calls, in order

| # | Who calls and what they say | What to notice | Where it goes |
|---|---|---|---|
| 1 | New client, English. "I got fired after complaining about overtime." Confirm caller id as the number. | The greeting itself says a transcript is kept. One question at a time. Never asks why they're calling. Hand-off: "I'm transferring you to an intake manager." | Intake phone rings; whisper heard; caller bridged. |
| 2 | New client, Spanish. Same story in Spanish. | Maya follows into Spanish without being asked. Same script, same order. | Intake phone; whisper is in English for the staff member. |
| 3 | Existing client. "I already have a case, I want to check on it." | Same short path: name and number. No new-client questions. | Admin phone. |
| 4 | "Can I speak to Walter?" | Maya does not transfer to Walter or give a number. Says intake will make sure he gets the message. | Intake phone; whisper ends with "They asked for Walter by name." |
| 5 | New client who asks "Do I have a case?" and "How much do you charge?" | Both get "That's exactly what our team will go over with you." No legal information. Flow continues. | Intake phone. |
| 6 | New client, and nobody answers the intake phone (let it ring out). | Up to thirty seconds of ringing, then the fallback: "I couldn't reach an intake manager just now... they'll call you back within the hour" (8am to 8pm Pacific; "first thing in the morning" otherwise). She asks if there's anything to add and waits for the answer before goodbye. | No transfer. A callback email goes out (once the alert script is set up), and the review page shows a callback Task. |

Optional if there is time: silence after the greeting (Maya says "Take your time.", then "Are you still there?", and the call ends on its own if the silence continues); a caller who asks "Are you a real person?" (Maya says she's an automated assistant and keeps going).

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

When your phone rings on a transfer, you are on a private line with Maya. The caller hears music. She briefs you and asks "Can you take them?" Then she listens. Try:

- "How angry is he?"
- "What exactly did she say?"
- "Did they ask for anyone?"
- "What did you tell them?"

She answers from what the caller told her, in their own words. Only a clear yes ("yes", "sure", "put them through") connects the caller. "No", "I can't right now", or anything unclear does not: if it's unclear she asks once more, and otherwise she goes back to the caller with the callback message. If you say nothing for about 45 seconds, she does the same.
