# Retell setup and verification checklist

Phase 0 deliverable. Each item below is something the design depends on that has not been confirmed against Retell's current documentation or account. Record the answer, the source (doc URL, support ticket, or a test call), and the date. The build does not start on an item until its row is answered.

## Items to verify

| # | Question | Why it matters | Answer | Source | Date |
|---|---|---|---|---|---|
| 1 | Does the agent `language` setting accept a multilingual value (documented as `"multi"`) that auto-detects English and Spanish and follows a mid-call switch? Which voices support it? | Bilingual greeting and language switch (scenarios 9, 10) | | | |
| 2 | On a Call Transfer node with warm transfer, what is the exact field for the private handoff (whisper) message, and can it be a static string containing dynamic variables? | The briefing in `prompts/briefing.md` | | | |
| 3 | What happens when `agent_detection_timeout_ms` elapses: is the transfer cancelled (desired) or bridged? Is the action configurable? | 25 second ring timeout then next slot (scenario 11) | | | |
| 4 | Is voicemail on the transferee leg detected and treated as a failed transfer so the "transfer failed" edge fires? | Scenario 12; never whisper into voicemail | | | |
| 5 | Does a transferee hanging up during the whisper fire the "transfer failed" edge? | Decline by hang-up (scenario 14) | | | |
| 6 | Is an explicit accept/decline mechanism available ("chat with agent first" or an agentic transfer agent), and is it stable on this account? | Upgrade path from hang-up-to-decline | | | |
| 7 | If a transfer node's destination variable is empty or `"none"`, does the node fail fast to the failed edge, or can an edge condition skip it? | Padding unused slots | | | |
| 8 | Does the inbound call webhook response's `dynamic_variables` populate the flow's variables, and does `metadata` round-trip into the call object on later webhooks? | Routing injection and snapshot lookup | | | |
| 9 | What is the inbound webhook timeout, and if it fails or times out, does the call still connect using the agent's `default_dynamic_variables`? | Service-down fallback to the admin list (scenario 24) | | | |
| 10 | Is the inbound webhook signed with `X-Retell-Signature` like the post-call webhook? | Endpoint security | | | |
| 11 | Which data storage setting discards audio while still delivering the transcript on the post-call webhook? If none, does "basic attributes only" still include the transcript in the webhook payload? | "Transcribed, not recorded" disclosure; counsel wording | | | |
| 12 | What are the exact `disconnection_reason` values for: transferred, user hang-up, agent hang-up, inactivity, machine detected, error? | Disposition derivation | | | |
| 13 | In `transcript_with_tool_calls`, how is a transfer attempt and its outcome represented? Is node history exposed anywhere on the call object? | Who accepted the transfer, Lead owner | | | |
| 14 | Minimum values and interaction of `reminder_trigger_ms`, `reminder_max_count`, `end_call_after_silence_ms`. Does a reminder reset the silence timer? | Silent caller hang-up at about 10 s (scenario 18) | | | |
| 15 | Does the post-call webhook retry on non-2xx, how many times, with what backoff? | Idempotency and sweeper design | | | |
| 16 | Can simulation test cases be exported and imported via API, and can transfer nodes be mocked in a simulation? | Storing tests in the repo | | | |
| 17 | Can the conversation flow be exported and re-published via the SDK, and does re-publishing the same flow produce a diff-free result? | `publish.ts` and `flow:diff` | | | |
| 18 | Does the account have a signed data processing agreement option and a training opt-out? | Confidentiality of intake facts | | | |
| 19 | Current per-minute pricing for voice agent usage, phone number monthly cost, and telephony per-minute cost. | Cost estimate | | | |

## Account setup (firm-owned)

1. Create the Retell workspace under a firm email address. Invite the developer as a member.
2. Buy one phone number in the firm's area code. Note it here: `________`.
3. Create an API key labeled "intake-service"; store it in the firm's password manager, never in the repo.
4. Create two agents: "Maya Intake (sandbox)" and "Maya Intake (prod)". Sandbox points at the sandbox service URL and Salesforce sandbox.
5. Set the storage setting per item 11 for prod. Sandbox may keep everything during phases 1 and 2 for debugging. Flip before the first real caller (phase 3 checklist).
6. Subscribe an ops address to the Retell status page.

## Test phones for phases 1 and 2

| Label | Behavior | Number |
|---|---|---|
| T1 | Answers and stays on | |
| T2 | Rings out | |
| T3 | Voicemail greeting | |
