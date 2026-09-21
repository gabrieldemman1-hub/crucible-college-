// Builds the Salesforce records the real system would create, from a Retell call object.
// Preview only: nothing is written anywhere. Field names follow PLAN-v2.md section 8.4.

const OUTCOME = {
  transferred_successfully: "Transferred Successfully",
  existing_client_transferred: "Existing Client Transferred",
  other_matter_transferred: "Other Matter Transferred",
  transfer_failed_message_taken: "Transfer Failed - Message Taken",
  abandoned: "Abandoned",
  spam: "Spam",
};
const CALLER_TYPE = { new_client: "New Client", existing_client: "Existing Client", other: "Other", unknown: "New Client" };
const LANGUAGE = { en: "English", es: "Spanish", other: "Unknown", unknown: "Unknown" };

export function toE164(raw, fallback) {
  if (!raw || raw === "CALLER_ID") return fallback || null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return fallback || null;
}

export function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { FirstName: "", LastName: "Unknown Caller" };
  if (parts.length === 1) return { FirstName: "", LastName: parts[0] };
  return { FirstName: parts.slice(0, -1).join(" "), LastName: parts[parts.length - 1] };
}

/** Which transfer tools were invoked and whether they succeeded, from transcript_with_tool_calls. */
export function transferAttempts(call) {
  const log = call.transcript_with_tool_calls || [];
  const invocations = new Map();
  const attempts = [];
  for (const u of log) {
    if (u.role === "tool_call_invocation" && /^transfer_/.test(u.name || "")) {
      invocations.set(u.tool_call_id, { tool: u.name, succeeded: null, result: "" });
      attempts.push(invocations.get(u.tool_call_id));
    } else if (u.role === "tool_call_result" && invocations.has(u.tool_call_id)) {
      const a = invocations.get(u.tool_call_id);
      a.result = u.content || "";
      a.succeeded = u.successful === true || /transferred|bridged|success/i.test(a.result) && !/fail|no answer|busy|voicemail/i.test(a.result);
    }
  }
  return attempts;
}

export function deriveDisposition(call, analysis) {
  const attempts = transferAttempts(call);
  const reason = call.disconnection_reason || "";
  const transferred = reason === "call_transfer" || reason === "transfer_bridged" || attempts.some((a) => a.succeeded === true);
  const hasIdentity = Boolean(analysis.caller_full_name) || Boolean(analysis.callback_phone);
  let key;
  if (transferred) {
    key = analysis.caller_type === "existing_client" ? "existing_client_transferred"
      : analysis.caller_type === "other" ? "other_matter_transferred"
      : "transferred_successfully";
  } else if (analysis.message_taken || (attempts.length && !transferred)) {
    key = "transfer_failed_message_taken";
  } else if (["inactivity", "marked_as_spam", "scam_detected", "error_no_audio_received"].includes(reason) && !hasIdentity) {
    key = "spam";
  } else {
    key = "abandoned";
  }
  const lastTool = attempts.length ? attempts[attempts.length - 1].tool : null;
  return { key, label: OUTCOME[key], attempts, transferred, lastTool };
}

/**
 * @returns {{ disposition, lead, contactTask, note, task, explanation: string[] }}
 */
export function buildSalesforcePreview(call, analysis, routing, opts = {}) {
  const disposition = deriveDisposition(call, analysis);
  const phone = toE164(analysis.callback_phone, call.from_number);
  const name = splitName(analysis.caller_full_name);
  const when = new Date(call.start_timestamp || Date.now());
  const stamp = when.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const transcript = (call.transcript || "").trim();
  const explanation = [];

  const acceptedBy = disposition.transferred ? routing.target : null;
  const owner = acceptedBy?.salesforceUserId ? `${acceptedBy.name} (User ${acceptedBy.salesforceUserId})`
    : acceptedBy ? `${acceptedBy.name} (their Salesforce user)` : "Queue: AI Intake Unassigned";

  const note = {
    Title: `AI Intake call ${stamp} (${call.call_id})`,
    Body: [
      `Language: ${LANGUAGE[analysis.language] || "Unknown"} | Caller type: ${CALLER_TYPE[analysis.caller_type] || "Unknown"} | Outcome: ${disposition.label}`,
      `Routing: ${routing.list} -> ${routing.target ? routing.target.name : "no transfer"}`,
      "",
      transcript || "(no transcript)",
    ].join("\n"),
  };

  let lead = null;
  let contactTask = null;
  let task = null;

  const callerType = analysis.caller_type || "unknown";
  const wantsLead = callerType !== "other" && disposition.key !== "spam" && (disposition.key !== "abandoned" || phone);

  if (callerType === "existing_client" && opts.contactMatch) {
    explanation.push("Existing client whose phone matches a Contact: a Task and Note go on the Contact, no new Lead.");
    contactTask = {
      WhoId: `Contact ${opts.contactMatch}`,
      Subject: `Existing client called: ${analysis.reason || "(no reason given)"}`,
      Status: "Not Started", Priority: "Normal", Type: "Call", Retell_Call_Id__c: call.call_id,
    };
  } else if (wantsLead) {
    lead = {
      FirstName: name.FirstName,
      LastName: name.LastName,
      Company: "Unknown (AI Intake)",
      Phone: phone || "",
      Preferred_Language__c: LANGUAGE[analysis.language] || "Unknown",
      Caller_Type__c: CALLER_TYPE[callerType],
      Description: analysis.reason || "",
      Intake_Transfer_Outcome__c: disposition.label,
      LeadSource: "Phone - AI Intake",
      Owner: owner,
      Retell_Call_Id__c: call.call_id,
    };
    explanation.push(phone
      ? `Lead upsert by phone ${phone}: update if a Lead with this number exists, otherwise create.`
      : "No phone captured: Lead would be created without a phone and flagged for follow-up.");
    if (callerType === "existing_client") explanation.push("Caller said existing client but no Contact matched: Lead created with Caller Type 'Existing Client' so admin can reconcile.");
  } else if (callerType === "other") {
    explanation.push("Other matter: no Lead. A Task goes to the admin team with the message.");
  } else if (disposition.key === "spam") {
    explanation.push("Spam or silence with no identity captured: nothing written to Salesforce, only a row in the service log.");
  } else {
    explanation.push("Abandoned before a phone number was captured: nothing written to Salesforce.");
  }

  const needsTask = callerType === "other" || disposition.key === "transfer_failed_message_taken" || (disposition.key === "abandoned" && disposition.attempts.length > 0);
  if (needsTask && disposition.key !== "spam") {
    const assignee = routing.target ? routing.target.name : (routing.staffIds[0] ? routing.staffIds[0] : "admin team");
    task = {
      Subject: callerType === "other" ? `Message from ${analysis.caller_full_name || "caller"}: ${analysis.reason || ""}`
        : `Callback needed ${routing.callbackWindow}: ${analysis.caller_full_name || "caller"}`,
      Description: `${analysis.reason || ""}\nPhone: ${phone || "not captured"}\nLanguage: ${LANGUAGE[analysis.language] || "Unknown"}`,
      Owner: assignee,
      Status: "Not Started", Priority: disposition.key === "transfer_failed_message_taken" ? "High" : "Normal",
      Type: "Call", ActivityDate: when.toISOString().slice(0, 10), Retell_Call_Id__c: call.call_id,
    };
    explanation.push(`Task created for ${assignee}${disposition.key === "transfer_failed_message_taken" ? " because no one answered the transfer; an email alert also goes out." : "."}`);
  }

  if (disposition.transferred) explanation.push(`Lead owner is ${acceptedBy?.name || "the accepting staff member"} because they accepted the transfer.`);

  return { disposition, lead, contactTask, note, task, explanation, phone, name };
}
