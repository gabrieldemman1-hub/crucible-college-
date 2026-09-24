# Upwork post: AI voice engineer

Paste-ready. Copy the title, the description, and the screening questions into Upwork. The
settings table at the end is for you, not for the post.

---

## Title

AI phone receptionist for a law firm: build on Retell AI from a working prototype

## Description

We are a California employment law firm. About one in four of our inbound calls goes unanswered, and a missed call is often a lost client. We are fixing that with an AI phone receptionist that answers every call, day and night, in English or Spanish.

A prototype already works on a real phone number, built on Retell AI. It greets the caller, asks whether they are a new or existing client, takes their name and phone number, and transfers them to the right person. You will turn it into the production system.

**What you will build, in four phases, each with an acceptance gate**

1. Reliable transfers. The agent calls the staff member, briefs them, and connects the caller only after the staff member says yes. If nobody accepts, it takes a message and the team gets an email. Everything is published to Retell by script from our repository.
2. A small Node or TypeScript service: call webhooks with signature checks, Postgres, a Salesforce Lead created or updated by phone number, and email alerts for callbacks.
3. A one-week pilot: our phone system (Nextiva) forwards unanswered calls to the agent. Daily review and tuning.
4. Full cutover, monitoring, a rollback drill, a written runbook, and a recorded handover.

**A known problem you start with.** Retell's agentic warm transfer (staff must accept before the caller is connected) failed before dialing on our live test calls, while the plain warm transfer works. Solving that, or proposing an alternative that keeps "staff must say yes", is your first task.

**How we work**

- Everything through pull requests in our GitHub repository. An independent consultant reviews every pull request and checks each gate with their own test calls. Nothing merges without their approval.
- We own every account. You get access, not ownership. Credentials come from our password vault, never by chat.
- Cost control is part of the job. Retell bills for every simulated test conversation. You report vendor spend weekly and get written approval before any test run expected to cost more than $25.
- Call transcripts contain people's legal situations. Treat them as confidential. The build must work with audio storage turned off.
- A written status every Friday and one 30-minute call a week at 8 a.m. Pacific. Otherwise your hours are your own.
- Paid by milestone at each gate.

**Must have**

- Shipped at least one voice AI agent to real callers (Retell, Vapi, Bland, ElevenLabs Agents, or similar). You will be asked to show it and say what broke.
- Node.js or TypeScript services with webhooks, signature verification, and a relational database.
- Salesforce REST API with OAuth.
- Telephony basics: call forwarding, caller ID, warm versus cold transfer.
- Clear written English. A non-engineer must be able to follow your pull request descriptions.

**Nice to have:** Spanish; Nextiva or another hosted phone system; work for a law firm or another confidential client.

**Process.** Shortlisted candidates do a paid half-day test task on the prototype ($150 fixed). We judge the pull request, not the interview. Then a 45-minute call with our consultant. Start as soon as hired. Estimated effort is 19 to 24 working days over five to six weeks, then four weeks of support of up to 12 hours.

**To apply**, answer the screening questions. Applications that skip them are not read.

## Screening questions

1. Link or describe a voice agent you shipped to real callers. What platform, how many calls a day, and what was the worst thing that broke after launch?
2. A transfer tool on a voice platform returns a generic "transfer failed" error before it dials, and nothing in the configuration looks wrong. What do you check, in order?
3. Our Salesforce login expires at 2 a.m. What happens to the 3 a.m. calls in your design, and what do we see the next morning?
4. Voice platforms bill for simulated test calls. How do you keep testing thorough without surprising the client with a bill?
5. What three things would you need from us before you could commit to an estimate?

## Suggested Upwork settings

| Setting | Value |
|---|---|
| Project type | Fixed price with milestones, one per gate |
| Budget | $6,200 (22 days at $35 an hour). Milestones: gate 1 $1,240, gate 2 $1,860, gate 3 $1,860, gate 4 and handover $1,240. Hold up to $1,240 more for extra scope agreed in writing. |
| Preferred locations | Set in talent preferences, not in the text: Pakistan, Bangladesh, Sri Lanka, Nepal, Philippines, Indonesia, Vietnam, Egypt, Kenya, Nigeria |
| Time zone | Require "available for one weekly call at 8 a.m. Pacific". Do not require US hours. |
| Experience level | Expert |
| Duration | 1 to 3 months |
| Skills tags | Node.js, TypeScript, Retell AI, Voice AI, Salesforce API, Webhooks, PostgreSQL, Telephony |
| Visibility | Public, with the screening questions mandatory |
| Contract terms to add | Work for hire; confidentiality covering call transcripts; credentials from our vault only; vendor spend over $25 per test run needs written approval; handover is a deliverable |
