# Go live: from "I have a number and a key" to Maya's first call

Everything in this folder has been checked offline. What remains needs a session that can reach
Retell, which means three settings changes you make once, at a computer, then a new session.

## Part 1: settings (about five minutes, at a computer)

1. **Rotate the key.** The first key was pasted into a chat. In the Retell dashboard, delete it and
   create a new one. Never paste a key into chat; the steps below keep it out of the transcript.
2. **Open the environment.** On claude.ai/code there is no settings page for environments. In the
   row just above the message box, select the cloud button that shows the current environment's
   name (usually "Default"). Hover over that environment in the menu and select the settings
   icon that appears on its right. The "Update cloud environment" dialog opens.
3. **Give the session the key.** Two ways; the first is better if you see it.

   **A. API credentials (Pro and Max plans).** Below "Environment variables", find "API
   credentials" and select "Add credential". Credential type "Bearer". Name: `Retell`. Allowed
   websites: `api.retellai.com`. Custom headers: name `Authorization`, prefix `Bearer`, value: the
   new key. Select "Connect". The key never enters the session, and this also opens the network
   path to Retell, so step 4 is not needed. Leave `RETELL_API_KEY` unset.

   **B. Environment variable (Team and Enterprise plans, or if A is not shown).** In the
   "Environment variables" box add a line `RETELL_API_KEY=key_...`. Anyone who uses the
   environment can read it, so rotate it after the demo.
4. **Network access (only for B).** Set "Network access" to "Custom", check "Also include
   default list of common package managers", and add `api.retellai.com` to "Allowed domains".
5. **Non-secret values.** In the same "Environment variables" box, optionally add:

   | Line | Value |
   |---|---|
   | `RETELL_PHONE_NUMBER=` | the number you bought, as `+1XXXXXXXXXX` |
   | `INTAKE_PHONE=` | the phone that plays intake manager, `+1XXXXXXXXXX` |
   | `INTAKE_NAME=` | that person's first name |
   | `ADMIN_PHONE=` | the phone that plays admin, `+1XXXXXXXXXX` |
   | `ADMIN_NAME=` | that person's first name |
   | `FIRM_NAME=` | the firm name exactly as Maya should say it |
   | `MAIN_OFFICE_NUMBER=` | the number Maya reads out if a caller refuses transcription |

   These can also be sent in chat instead.
6. **Save changes, then start a new session** on branch `claude/law-firm-voice-intake-agent-2jx95t`.
   A running session never sees environment changes.

## Part 2: the message to paste into the new session

> Run the proof of concept in `voice-intake-agent/poc/` end to end. Start with
> `node voice-intake-agent/poc/agent/preflight.mjs` and fix anything it reports. Then pick a voice
> with `--voices`, create the agent, and tell me when to place the first call. I have the intake
> phone and the admin phone with me. Work through `voice-intake-agent/poc/DEMO.md` scenarios one
> at a time, pulling calls and refreshing the review page after each, and fix Maya's wording
> between calls. Do not write the API key anywhere in the repo.

## Part 3: what happens in that session (about an hour with both phones in hand)

| Step | Command | You do |
|---|---|---|
| Preflight | `node poc/agent/preflight.mjs` | nothing; it checks the key, the number, and the settings |
| Choose a voice | `node poc/agent/create-agent.mjs --voices` | listen to two or three previews, say which |
| Create Maya | `node poc/agent/create-agent.mjs` | nothing |
| First call | | call the number from any phone, say you are a new client, answer the intake phone when it rings, listen for the whisper |
| Transfer edge cases | | hang up during the whisper; let the intake phone ring out; call as an existing client so the admin phone rings; one call in Spanish |
| Six demo scenarios | | as scripted in `DEMO.md` |
| Review page | `node poc/review/pull-calls.mjs && node poc/review/build-page.mjs` | open the published page and check each call's three cards |
| Wrap up | `node poc/agent/create-agent.mjs --unbind` | only when you want the number to stop answering |

## Things the first live run will settle

These could not be confirmed offline. The session will check each and adjust.

- Warm transfer with a whisper is available on the account's plan. If not, re-run
  `create-agent.mjs` with `TRANSFER_MODE=cold`: plain transfer, and Maya tells the caller what she
  is passing along before connecting them.
- The transfer target hears the whisper before the caller is bridged, and hanging up during the
  whisper returns Maya to the caller with the fallback message.
- Language detection follows the caller after the bilingual greeting without an explicit choice.
- Post-call analysis fields come back populated for a call under two minutes.
- The chosen voice sounds natural in both languages. If not, try a different multilingual voice.

## If you would rather not change environment settings

Run the same commands on a laptop with Node 20 or newer: clone the branch, set the variables in
the terminal with `export NAME=value`, and run the commands from the repo root. The review page
is still built locally; send `poc/review/index.html` to a session to publish it.
