# Greeting and disclosure wording

**For counsel review.** These are the exact words the agent says at the start of every call, before any question. Nothing else in the call refers to recording or transcription. Once approved, this file is copied verbatim into the `greet_disclose` node of the conversation flow; the file is the source of truth.

Placeholders: `{{firm_name}}` is the firm's name as it should be spoken. `{{agent_name}}` is the agent's name (placeholder "Maya").

## Why the wording is shaped this way

- California Penal Code 632 requires all-party consent to record a confidential communication. Transcription is arguably a recording of the call's contents, so the disclosure is given first, in the caller's language, and continuing the call is treated as consent.
- The agent identifies itself as a virtual assistant in the first sentence, before asking anything, to satisfy California's bot disclosure requirement (Bus. & Prof. Code 17940 et seq.) and to avoid any suggestion that the caller is speaking to a person.
- "Transcribed, not recorded" is only accurate if the Retell storage setting discards audio. If Retell cannot discard audio while keeping the transcript, the second sentence must change to "This call may be recorded and transcribed for our records." Confirm the storage setting (see `docs/retell-setup.md`) before approving the wording.
- No legal information is given anywhere in the call. The agent's only promises are that it will take details and connect the caller.

## Opening line (bilingual, before language is known)

> Thank you for calling {{firm_name}}. Gracias por llamar a {{firm_name}}.

If the caller's first words do not make the language clear:

> Would you prefer English or Spanish? ¿Prefiere inglés o español?

## Disclosure, English

> Hi, I'm {{agent_name}}, the virtual assistant for {{firm_name}}. This call is transcribed for our records, but not recorded. I'll take a few quick details and connect you with the right person. Are you a new client, or do you already have a case with us?

**Revised after the first live calls (Sep 22).** The firm found the sentence above read like a form when spoken. The agent now identifies itself in the greeting ("this is {{agent_name}}, the firm's virtual assistant"); the greeting is English only, because the mid-sentence switch to Spanish sounded synthetic on live calls, and the agent switches to Spanish the moment a caller uses it and gives the transcription fact in passing, in natural words, immediately before asking for the caller's name. The two facts (transcript kept, not recorded) are required; the exact words are not. Example the agent is given:

> Sure. Just so you know, we keep a transcript of the call, but it's not recorded. Can I get your full name?

Spanish:

> Claro. Solo para que sepa, guardamos una transcripción de la llamada, pero no se graba. ¿Me da su nombre completo?

Counsel should review whether "in passing, natural words, two fixed facts" meets the standard, or whether fixed wording is required. If fixed wording is required, the example sentence above is the proposed fixed wording.

## Disclosure, Spanish

> Hola, soy {{agent_name}}, la asistente virtual de {{firm_name}}. Esta llamada se transcribe para nuestros registros, pero no se graba. Le tomaré unos datos rápidos y le comunicaré con la persona indicada. ¿Es usted un cliente nuevo, o ya tiene un caso con nosotros?

## Alternate second sentence, if audio cannot be discarded at the platform

English:
> This call may be recorded and transcribed for our records.

Spanish:
> Esta llamada puede ser grabada y transcrita para nuestros registros.

## If the caller objects to transcription

The agent does not argue and does not continue collecting details. It says:

English:
> I understand. I can't continue without transcription, but I can give you a number to call back and speak with someone directly. It's {{main_office_number}}. Thank you for calling.

Spanish:
> Entiendo. No puedo continuar sin transcripción, pero puedo darle un número para que llame y hable directamente con alguien. Es {{main_office_number}}. Gracias por llamar.

Then the agent ends the call. The service logs the call with disposition "abandoned" and no Lead. Counsel to confirm this is the desired behavior, or whether the agent should instead transfer without collecting anything.

## Out-of-scope answers the agent gives

When asked anything about the merits, fees, timelines, or outcomes:

English:
> That's exactly what the intake manager will go over with you. Let me get you to them.

Spanish:
> Eso es exactamente lo que el gerente de admisión revisará con usted. Permítame comunicarle.

## Sign-off

| Reviewer | Date | Approved wording | Notes |
|---|---|---|---|
| | | | |
