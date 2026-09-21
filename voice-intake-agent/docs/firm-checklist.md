# What the firm needs to do and send back

Everything on this list is on the firm's side. Phase 1 (the callable prototype) can start the day the "Blocks phase 1" items are done. The rest can arrive during phase 1.

## Blocks phase 1

| # | Item | Who | Done |
|---|---|---|---|
| 1 | Create a Retell AI account under a firm email, buy one phone number, invite the developer. See `docs/retell-setup.md`. | Firm owner | |
| 2 | Create a hosting account (Railway or Render) under a firm email with a managed Postgres, invite the developer. | Firm owner | |
| 3 | Send the staff routing list: for each intake manager, admin, and the overnight person: first name, direct-dial number, email, languages spoken. Placeholders are fine at first. Format in `config/routing.example.json`. | Intake lead | |
| 4 | Name one person who will own the routing list after launch (adds and reorders people). | Firm owner | |
| 5 | Choose the agent's name (placeholder "Maya"). Voice is chosen in phase 1 from three samples. | Firm owner | |
| 6 | Three test phones for transfer testing: one that answers, one that rings out, one with voicemail. Can be staff cell phones. | Intake lead | |

## Needed during phase 1, before phase 2

| # | Item | Who | Done |
|---|---|---|---|
| 7 | Counsel reviews `prompts/disclosure.md` and signs off on the wording, including the "caller objects" behavior. | Counsel | |
| 8 | Salesforce edition (Setup, Company Information, Organization Edition). If Professional, confirm the API add-on. | Salesforce admin | |
| 9 | Salesforce sandbox access for the developer, plus an admin who can create custom fields, a queue, an integration user, a permission set, and a Connected App. Steps in `PLAN-v2.md` section 9. | Salesforce admin | |
| 10 | Salesforce user ids for each intake manager (for Lead ownership). | Salesforce admin | |
| 11 | Email service for alerts: a SendGrid account or SMTP credentials on a firm domain, plus the list of alert recipients. | IT | |
| 12 | Nextiva plan tier, and an admin who can change forwarding on the main number. | Nextiva admin | |

## Needed before phase 3 (pilot)

| # | Item | Who | Done |
|---|---|---|---|
| 13 | Real staff numbers in the routing list. | Intake lead | |
| 14 | Each intake manager and admin available for two practice transfers (about 10 minutes each). | Intake lead | |
| 15 | Confirm with Nextiva support: does the plan pass the original caller id on forwarded calls, and does it support Sequential Ring to an external number? | Nextiva admin | |
| 16 | Production Salesforce setup repeated from sandbox. | Salesforce admin | |
| 17 | Go-live approval for overflow forwarding. | Firm owner | |

## Decisions already made (for reference)

- Name and phone only before transfer. No email.
- Warm transfer with a briefing. Staff staying on the line accepts; hanging up declines.
- Nobody answers: message, callback within one business hour, Salesforce Task, email alert. No hold queue in v1.
- Callers asking for Walter, Peg, or Anthony go to intake.
- Vendors, opposing counsel, courts: message and admin transfer, Task not Lead.
- No after-hours mode. Overnight is just a different routing list.
- No audio recording. Transcript only.
- No dashboard in v1. Routing is a file; kill switch is the Nextiva forwarding setting.
