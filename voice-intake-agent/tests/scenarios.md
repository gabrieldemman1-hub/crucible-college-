# Scripted caller scenarios

> **Production test plan (multi-person routing, conversation flow).** For what the proof-of-concept Maya does today, the source of truth is `poc/agent/prompt.md`, and the automated checks are `poc/tests/scenarios.json`. Where this file differs (for example the full disclosure before any question, or asking the reason), the POC files win until this plan is revised.

Run each scenario in English and Spanish by calling the Retell number from a cell phone. Transfer slots point at three test phones during phases 1 and 2:

- **T1** answers and stays on the line (accept).
- **T2** rings out (no answer).
- **T3** goes to a voicemail greeting.

Unless a scenario says otherwise, the routing config under test is `config/routing.example.json` with T1, T2, T3 substituted for the first three intake slots and for the admin slots as noted.

## Pass criteria that apply to every scenario

| Check | Pass |
|---|---|
| Disclosure | The full disclosure from `prompts/disclosure.md` is spoken, in the caller's language, before any question. Never repeated. |
| One question at a time | No turn contains two questions. |
| No legal information | The agent never characterizes the case, gives fees, timelines, outcomes, or opinions. Post-call flag `legal_information_given` is false. |
| Read-back | Any phone number the caller dictates is read back in groups of three, three, four and confirmed. |
| Time to transfer | Median under 60 seconds from answer to first dial for new clients; under 45 seconds for existing clients. Measured from the service logs. |
| Salesforce | The record described in the scenario exists in the sandbox within 2 minutes of hang-up, with the stated disposition, and no duplicate. |
| Service row | One row in `calls` for the call id with the stated disposition and `accepted_by_staff_id`. |

## Scenarios

### 1. New client, cooperative, caller id accepted
Caller: new client, gives full name, confirms the number they are calling from is best, one sentence about being fired.
Expect: classify new; name captured; phone = caller id; reason captured; hold message names slot 1; T1 whisper contains name, "a new client", language, reason, number; caller bridged to T1. Lead created, owner = T1's Salesforce user, disposition Transferred Successfully, Note with transcript.

### 2. New client gives a different number
Caller: as 1, but says "no, use my cell" and dictates a different number.
Expect: dictated number read back and confirmed; Lead Phone = dictated number in E.164, not caller id.

### 3. Repeat caller
Caller: same phone as scenario 1, calls again the next day with a different reason.
Expect: existing Lead updated (Description and disposition), not duplicated; second Note added; Notes sort newest first.

### 4. Existing client, Contact match
Setup: a Contact in sandbox with the caller's phone. Caller: "I already have a case, I want to check on it."
Expect: classify existing; name and number captured; admin chain; T1 whisper says "an existing client"; Task on the Contact, Note on the Contact, no new Lead; disposition Existing Client Transferred.

### 5. Existing client, no match
Caller: says existing client, phone not in sandbox.
Expect: admin chain as 4; Lead created with Caller Type "Existing Client" so admin can reconcile; disposition Existing Client Transferred.

### 6. "Do I have a case?" and "How much do you charge?"
Caller: new client, asks both questions before giving details.
Expect: each deflected with the out-of-scope line from `prompts/disclosure.md`; no answer given; flow continues to collect name and phone; `legal_information_given` false.

### 7. Asks for senior management by name
Caller: "Can I speak to Walter?" (repeat with Peg, Anthony).
Expect: never dialed to any personal number; routed to the intake chain; whisper includes "They asked for Walter by name"; `asked_for_senior_management` true.

### 8. Other matter
Caller: opposing counsel, then a court clerk, then a vendor.
Expect: classify other; name, organization, number, message captured; admin chain; whisper says "Not a client"; Task assigned to first admin, no Lead; disposition Other Matter Transferred.

### 9. Language switch mid-call
Caller: starts in English, switches to Spanish after the disclosure.
Expect: agent follows into Spanish; `language` = es; Spanish intake chain used; Preferred Language = Spanish.

### 10. Ambiguous first utterance
Caller: "Hello, hola, hi."
Expect: agent asks "English or Spanish?" once; proceeds in the chosen language.

### 11. Slot 1 rings out, slot 2 answers
Setup: intake EN slots = T2, T1.
Expect: 25 second ring on T2 then failed; "Thank you for holding, trying {slot 2}"; whisper to T1; `accepted_by_staff_id` = slot 2's id; owner = slot 2.

### 12. Slot 1 voicemail, slot 2 answers
Setup: slots = T3, T1.
Expect: voicemail detected, no whisper left on T3's voicemail; next slot dialed; accepted by slot 2.

### 13. All slots fail
Setup: slots = T2, T3, T2.
Expect: three attempts; fallback message with "within one business hour"; call ends politely; Lead created with disposition Transfer Failed - Message Taken; Task assigned to slot 1's Salesforce user; fallback email to slot 1's address plus CC with name, number, language, reason.

### 14. Staff declines by hanging up during whisper
Setup: slots = T1, T1. First answer hangs up mid-whisper.
Expect: treated as failed; second slot dialed; caller bridged on the second attempt.

### 15. After hours, new client
Setup: call outside `businessHours` or on a holiday date.
Expect: overnight person's number in slot 1 for both languages; fallback wording "first thing in the morning" if unanswered.

### 16. After hours, existing client
Setup: as 15, `overnight.handlesExistingClients` = false.
Expect: no dial attempted; fallback message with morning wording; Task to first admin; disposition Transfer Failed - Message Taken.

### 17. Hang up after name only
Caller: gives name, hangs up before the phone question.
Expect: if caller id present, partial Lead with disposition Abandoned; if caller id absent, no Lead; `calls` row exists either way.

### 18. Silence
Caller: says nothing.
Expect: one re-prompt; hang-up after about 10 seconds of silence; disposition Spam; no Lead.

### 19. Robocall
Caller: plays a recorded IVR message.
Expect: no legal talk; no Lead unless a phone number was somehow captured; disposition Spam or Abandoned.

### 20. Distressed, long-talking caller
Caller: describes the situation at length, emotional.
Expect: one sentence of acknowledgement; gently redirected ("I'll make sure {slot} hears all of this. First, may I have your name?"); transfer under 2 minutes.

### 21. Demands a human immediately
Caller: "I don't want to talk to a robot, get me a person."
Expect: agent asks only for a callback number, then dials the chain; reason recorded as "requested a person".

### 22. Third language
Caller: speaks Mandarin or Tagalog.
Expect: agent continues in English, captures a callback number, takes a message, admin chain; Task created.

### 23. Caller objects to transcription
Caller: "I don't want this transcribed."
Expect: agent gives the main office number per `prompts/disclosure.md`, ends the call; no Lead; disposition Abandoned. (Counsel may change this behavior.)

### 24. Intake service down during a call
Setup: stop the service, place a call.
Expect: call still answered; agent uses default dynamic variables (admin list); when the service restarts, Retell webhook retries land and the Salesforce record is created.

### 25. Salesforce unavailable
Setup: revoke the sandbox Connected App secret, place scenario 1.
Expect: call completes normally; `sf_jobs` row pending with attempts increasing; degraded alert email after about 30 minutes; restore the secret; job completes and the Lead appears.

## Recording results

| # | Language | Date | Pass / Fail | Notes |
|---|---|---|---|---|
| | | | | |
