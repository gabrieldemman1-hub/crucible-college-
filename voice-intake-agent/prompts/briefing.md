# Warm transfer briefing (whisper) templates

Spoken by the agent to the staff member only, after they answer and before the caller is bridged. The caller hears hold music. Kept under 12 seconds so the staff member is not left listening to a script.

Variables are Retell dynamic variables. `{{slot_name}}` is the staff member's first name from `routing.json`. `{{caller_type_spoken}}`, `{{language_spoken}}`, and `{{callback_phone_spoken}}` are derived phrasings set in the flow before the hold message (e.g. "a new client", "English", "four one five, five five five, oh one oh one").

## Intake transfer, English

> Hi {{slot_name}}, this is {{agent_name}}, the intake assistant. I have {{caller_name}} on the line, {{caller_type_spoken}}, speaking {{language_spoken}}. They're calling about: {{reason}}. Callback number {{callback_phone_spoken}}. Stay on the line to take the call, or hang up and I'll try the next person.

## Intake transfer, Spanish

Used only when the staff member's `whisperLanguage` is Spanish. In v1 every staff member speaks English, so the English whisper is used on both chains. Kept here for when that changes.

> Hola {{slot_name}}, soy {{agent_name}}, la asistente de admisión. Tengo a {{caller_name}} en la línea, {{caller_type_spoken}}, habla {{language_spoken}}. Llama por: {{reason}}. Número de contacto {{callback_phone_spoken}}. Quédese en la línea para tomar la llamada, o cuelgue y probaré con la siguiente persona.

## Admin transfer (existing client), English

> Hi {{slot_name}}, this is {{agent_name}}. I have {{caller_name}} on the line, an existing client, speaking {{language_spoken}}, calling about: {{reason}}. Callback number {{callback_phone_spoken}}. Stay on the line to take the call, or hang up and I'll try the next person.

## Admin transfer (other matter), English

> Hi {{slot_name}}, this is {{agent_name}}. I have {{caller_name}} from {{caller_organization}} on the line. Not a client. They're calling about: {{reason}}. Callback number {{callback_phone_spoken}}. Stay on the line to take the call, or hang up and I'll try the next person.

## Senior management ask

Same as the intake transfer, with one added clause after the reason:

> They asked for {{requested_person}} by name.

## Hold message to the caller (before the first dial)

English:
> Please hold for a moment while I connect you with {{slot_name}}. This may take a minute.

Spanish:
> Por favor espere un momento mientras le comunico con {{slot_name}}. Puede tardar un minuto.

## Between attempts (after a failed slot, before dialing the next)

English:
> Thank you for holding. I'm trying {{next_slot_name}} now.

Spanish:
> Gracias por esperar. Estoy intentando con {{next_slot_name}} ahora.

## Fallback message (all slots failed)

English:
> I'm sorry, everyone is helping other clients right now. I have your details, and someone will call you back {{callback_window}}. Is there anything else you'd like me to pass along?

Spanish:
> Lo siento, todos están atendiendo a otros clientes en este momento. Tengo sus datos, y alguien le devolverá la llamada {{callback_window}}. ¿Hay algo más que quiera que le transmita?

Then:

English:
> Thank you for calling {{firm_name}}. Goodbye.

Spanish:
> Gracias por llamar a {{firm_name}}. Hasta luego.

## Rules the flow enforces around these templates

- The whisper never includes the caller's employer, dates, or any legal characterization. Only what the caller said in their own words, in one sentence.
- If `{{reason}}` is empty, the phrase "They're calling about: ..." is omitted.
- If `{{callback_phone_spoken}}` is empty (no number captured), the whisper says "No callback number captured" so the staff member knows to ask.
- Voicemail on the staff leg is treated as a failed attempt. The whisper must never be left on a voicemail.
