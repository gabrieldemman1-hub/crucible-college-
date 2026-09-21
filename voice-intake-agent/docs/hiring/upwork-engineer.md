# Upwork post: AI voice intake engineer

Paste-ready. Replace the bracketed items. Suggested settings are at the end.

---

## Title

Build a production AI phone receptionist (Retell AI, Node, Salesforce) for a law firm, from a working proof of concept

## Description

We are a California employment law firm. About a quarter of our inbound calls go unanswered. We are replacing that with an AI voice agent that answers every call in English or Spanish, takes the caller's name, phone number, and reason, logs a lead in Salesforce, and warm-transfers the caller to the right intake manager with a spoken briefing.

The design is done and a proof of concept already works on a real phone number. You will turn it into the production system. The technical plan, routing rules, prompts, scenario list, and proof of concept are in a private GitHub repository you will get access to on day one.

**What you will build, in four phases with acceptance gates**

1. Retell AI conversation flow with a warm-transfer chain (whisper to staff, no-answer fallback), published to Retell by script from the repository.
2. A small Node service: inbound-call webhook that injects routing, post-call webhook with signature verification, Postgres store-and-forward, Salesforce lead upsert by phone, email alerts.
3. Pilot: our phone system (Nextiva) forwards unanswered calls to the agent for one week; daily review and tuning.
4. Full cutover, monitoring, rollback drill, runbook, and a recorded handover.

**How we work**

- Everything through pull requests in our GitHub organization. An independent consultant reviews every PR and verifies each gate by placing their own test calls. Nothing merges without their approval.
- All accounts (Retell, Salesforce, hosting, GitHub) are ours. You get access, not ownership. Credentials come from our vault, never by chat.
- A short written status every Friday and a 30-minute call every week.
- Payment by milestone at each gate (20 / 30 / 30 / 20 percent).
- No audio recording anywhere in the system; transcripts only. This is a legal requirement for us, not a preference.

**Must have**

- Shipped at least one voice AI agent to real callers on Retell, Vapi, Bland, ElevenLabs Agents, or similar. You will be asked to show it and describe what broke.
- Node.js or TypeScript services with webhooks, signature verification, and a relational database.
- Salesforce REST API with OAuth (Lead create and update).
- Telephony basics: E.164, call forwarding, caller id passthrough, warm vs cold transfer.
- Written English clear enough that a non-engineer can follow your PR descriptions.

**Nice to have**

- Spanish, or experience with bilingual agents.
- Nextiva or another hosted PBX.
- Working with a law firm or another confidentiality-heavy client.

**Process**

Shortlisted candidates do a paid half-day test task on the proof of concept (fixed price, [$AMOUNT]). We judge the pull request, not the interview. Then a 45-minute call with our consultant present. Start date [DATE]. Estimated effort 19 to 24 working days over five to six weeks, then a four-week support window of up to [N] hours.

**To apply**, answer the four screening questions. Applications that skip them are not read.

## Screening questions

1. Link or describe a voice agent you shipped to real callers. What platform, how many calls a day, and what was the worst thing that broke after launch?
2. How would you make certain that no caller audio is ever stored, and how would you prove it to a non-technical client?
3. Our Salesforce credentials expire at 2 a.m. What happens to the 3 a.m. calls in your design, and what does the client see the next morning?
4. What three things would you need from us before you could commit to an estimate?

## Suggested Upwork settings

| Setting | Value |
|---|---|
| Project type | Fixed price with milestones (one per gate), or hourly with a weekly cap if you prefer; fixed price matches the gate structure |
| Budget | [engineer days × rate; see DELIVERY-PLAN.md section 7] |
| Experience level | Expert |
| Duration | 1 to 3 months |
| Skills tags | Node.js, TypeScript, Retell AI, Voice AI, Salesforce API, Webhooks, PostgreSQL, Telephony |
| Visibility | Invite-only or public; if public, expect volume, so keep the screening questions mandatory |
| Milestones | Gate 1 callable prototype; Gate 2 Salesforce and webhook; Gate 3 pilot week; Gate 4 cutover and handover |
| Contract terms to add | Work for hire, confidentiality covering call transcripts, credentials from our vault only, handover as a deliverable |
