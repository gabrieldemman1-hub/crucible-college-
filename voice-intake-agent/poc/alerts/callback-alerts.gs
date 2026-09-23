/**
 * Callback alerts for Maya, as a Google Apps Script web app. Retell posts every analyzed call here;
 * when a caller needs a callback (the transfer didn't connect, or Maya took a message), this sends
 * one email with the caller's name, number, what happened, and the transcript.
 *
 * Setup (about 5 minutes), signed in to the Google account that should send the alerts:
 *   1. script.google.com > New project. Paste this file over the sample code.
 *   2. Set ALERT_TO and SECRET below. SECRET is any long random string.
 *   3. Run sendTestEmail once from the editor and approve the permissions. A test email arrives.
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy, copy the URL.
 *   5. The webhook URL for Retell is that URL plus ?key=SECRET. Run create-agent.mjs with
 *      ALERT_WEBHOOK_URL set to it.
 */
const ALERT_TO = 'you@example.com';
const SECRET = 'CHANGE_ME';
const FIRM = 'United Employees Law Group';
const TZ = 'America/Los_Angeles';

function doGet() {
  return ContentService.createTextOutput('Maya callback alerts are running.');
}

function doPost(e) {
  if (!e || !e.parameter || e.parameter.key !== SECRET) return text_('forbidden');
  let body;
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return text_('bad json'); }
  if (body.event !== 'call_analyzed' || !body.call) return text_('ignored');
  const call = body.call;

  // Retell may retry a webhook; send one email per call.
  const cache = CacheService.getScriptCache();
  if (cache.get(call.call_id)) return text_('duplicate');
  cache.put(call.call_id, '1', 21600);

  const alert = buildAlert_(call);
  if (!alert) return text_('no callback needed');
  MailApp.sendEmail({ to: ALERT_TO, subject: alert.subject, body: alert.body });
  return text_('sent');
}

function buildAlert_(call) {
  const a = (call.call_analysis && call.call_analysis.custom_analysis_data) || {};
  const log = call.transcript_with_tool_calls || [];
  const transfers = log.filter(function (u) { return u.role === 'tool_call_invocation' && /^transfer_/.test(u.name || ''); });
  const bridged = call.disconnection_reason === 'call_transfer' ||
    log.some(function (u) { return u.role === 'tool_call_result' && u.successful === true && /transferred|bridged/i.test(u.content || ''); });
  const needsCallback = a.message_taken === true || (transfers.length > 0 && !bridged);
  if (!needsCallback) return null;

  const name = a.caller_full_name || 'Caller who did not give a name';
  const phone = (!a.callback_phone || a.callback_phone === 'CALLER_ID') ? (call.from_number || 'no number captured') : a.callback_phone;
  const tried = transfers.length ? transfers[transfers.length - 1].name.replace('transfer_to_', '') : 'none';
  const when = Utilities.formatDate(new Date(call.start_timestamp || Date.now()), TZ, 'EEE MMM d, h:mm a');
  const what = transfers.length && !bridged
    ? (call.disconnection_reason === 'user_hangup' ? 'Caller hung up while waiting for the transfer.' : 'Transfer to ' + tried + ' did not connect.')
    : 'Caller left a message.';

  const lines = [
    'Callback needed.',
    '',
    'Name: ' + name,
    'Phone: ' + phone,
    'Caller type: ' + (a.caller_type || 'unknown') + '   Language: ' + (a.language || 'unknown'),
    'What happened: ' + what,
    'Tried: ' + tried,
    'When: ' + when + ' Pacific',
  ];
  if (a.caller_mood && a.caller_mood !== 'calm') lines.push('Mood: ' + a.caller_mood + (a.upset_about ? ' (' + a.upset_about + ')' : ''));
  if (a.requested_person) lines.push('Asked for: ' + a.requested_person);
  if (a.reason) lines.push('In their words: ' + a.reason);
  if (call.call_analysis && call.call_analysis.call_summary) lines.push('', 'Summary: ' + call.call_analysis.call_summary);
  lines.push('', 'Transcript:', (call.transcript || '(none)'), '', 'Retell call id: ' + call.call_id);

  return { subject: 'Callback needed: ' + name + ' (' + phone + ')', body: lines.join('\n') };
}

function sendTestEmail() {
  MailApp.sendEmail({ to: ALERT_TO, subject: 'Maya callback alerts: test', body: 'If you can read this, alerts from ' + FIRM + "'s phone line will reach this inbox." });
}

function text_(s) {
  return ContentService.createTextOutput(s);
}
