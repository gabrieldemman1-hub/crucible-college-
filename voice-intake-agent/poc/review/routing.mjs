// Routing rules for the proof of concept. Pure functions, no I/O, reused by pull-calls.mjs.
// Mirrors the rules in PLAN-v2.md section 6 and config/routing.schema.json, scaled down to the
// demo's two phones. Run `node poc/review/routing.mjs --selftest` to check the rules.

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Local wall-clock parts for a timestamp in an IANA zone. */
export function localParts(ts, timezone) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour12: false, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const hour = p.hour === "24" ? "00" : p.hour;
  return { day: p.weekday.toLowerCase().slice(0, 3), date: `${p.year}-${p.month}-${p.day}`, hhmm: `${hour}:${p.minute}` };
}

export function isBusinessHours(ts, config) {
  const { day, date, hhmm } = localParts(ts, config.timezone);
  if ((config.holidays || []).includes(date)) return false;
  const hours = config.businessHours[day];
  if (!hours) return false;
  return hhmm >= hours[0] && hhmm < hours[1];
}

/**
 * Decide where a call goes.
 * @param {object} call  { language: 'en'|'es'|'other'|'unknown', callerType: 'new_client'|'existing_client'|'other'|'unknown',
 *                         askedForSeniorManagement: boolean, requestedPerson?: string, at: epoch ms }
 * @param {object} config  routing config (timezone, businessHours, holidays, staff, lists, overnight, seniorManagement, callbackWindow)
 * @returns {{ list: string, staffIds: string[], target: object|null, reasons: string[], businessHours: boolean, callbackWindow: string }}
 */
export function decideRouting(call, config) {
  const reasons = [];
  const bh = isBusinessHours(call.at, config);
  const lang = call.language === "es" ? "es" : "en";
  const { hhmm, day } = localParts(call.at, config.timezone);
  reasons.push(bh ? `Inside business hours (${day} ${hhmm} ${config.timezone}).` : `Outside business hours (${day} ${hhmm} ${config.timezone}).`);

  let list;
  let staffIds;
  const wantsIntake =
    call.callerType === "new_client" || call.callerType === "unknown" || call.askedForSeniorManagement;

  if (call.askedForSeniorManagement) {
    reasons.push(`Caller asked for ${call.requestedPerson || "senior management"} by name. Senior management is never a transfer target; routed to intake instead.`);
  } else if (call.callerType === "existing_client") {
    reasons.push("Existing client: goes to the admin team, who look up the case and hand off.");
  } else if (call.callerType === "other") {
    reasons.push("Other matter (not a client): message taken, goes to the admin team.");
  } else if (call.callerType === "new_client") {
    reasons.push("New client: goes to the intake list.");
  } else {
    reasons.push("Caller type unclear: treated as a new client.");
  }

  if (wantsIntake) {
    if (bh) {
      list = `intake.${lang}`;
      staffIds = config.lists.intake[lang];
      reasons.push(lang === "es" ? "Caller spoke Spanish: Spanish intake list." : call.language === "other" ? "Caller spoke a third language: English list, transferred like any other caller." : "Caller spoke English: English intake list.");
    } else {
      list = "overnight";
      staffIds = config.lists.overnight;
      reasons.push("After hours: the overnight list replaces the intake list.");
    }
  } else if (bh) {
    list = "admin";
    staffIds = config.lists.admin;
  } else if (call.callerType === "other") {
    // No admin overnight: other matters get a message and a morning callback.
    list = "admin";
    staffIds = [];
    reasons.push("After hours: no admin on duty for other matters; message taken, callback in the morning.");
  } else if (config.overnight.handlesExistingClients) {
    list = "overnight";
    staffIds = config.lists.overnight;
    reasons.push("After hours: the overnight intake manager also takes existing clients.");
  } else {
    list = "admin";
    staffIds = [];
    reasons.push("After hours and the overnight person does not handle existing clients: no transfer attempted, callback in the morning.");
  }

  const target = staffIds.length ? { id: staffIds[0], ...config.staff[staffIds[0]] } : null;
  if (target) reasons.push(`First on the list: ${target.name} (${target.number}).`);
  if (staffIds.length > 1) reasons.push(`If no answer: ${staffIds.slice(1).map((id) => config.staff[id].name).join(", then ")}.`);

  const cw = bh ? config.callbackWindow.businessHours : config.callbackWindow.afterHours;
  return { list, staffIds, target, reasons, businessHours: bh, callbackWindow: cw[lang] || cw.en, callbackWindowStaff: cw.en };
}

/** Build a routing config for the demo from two phones plus the example config's hours and wording. */
export function demoConfig(base, { intakeName, intakePhone, adminName, adminPhone }) {
  return {
    ...base,
    staff: {
      intake: { name: intakeName, number: intakePhone, email: "", languages: ["en", "es"], role: "intake" },
      admin: { name: adminName, number: adminPhone, email: "", languages: ["en", "es"], role: "admin" },
    },
    lists: { intake: { en: ["intake"], es: ["intake"] }, admin: ["admin"], overnight: ["intake"] },
    overnight: { handlesExistingClients: true },
    // The same wording Maya uses (prompt.md section 6).
    callbackWindow: {
      businessHours: { en: "within the hour", es: "dentro de la hora" },
      afterHours: { en: "first thing in the morning", es: "a primera hora de la mañana" },
    },
  };
}

// ---------------------------------------------------------------- self-test
if (process.argv.includes("--selftest")) {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const base = JSON.parse(readFileSync(join(here, "..", "..", "config", "routing.example.json"), "utf8"));
  const cfg = demoConfig(base, { intakeName: "James", intakePhone: "+14155550101", adminName: "Ana", adminPhone: "+14155550201" });

  // Tuesday 2026-09-22 10:00 Pacific = 17:00 UTC. Saturday 2026-09-26 10:00 Pacific = 17:00 UTC.
  const weekday = Date.UTC(2026, 8, 22, 17, 0);
  const weekend = Date.UTC(2026, 8, 26, 17, 0);
  const night = Date.UTC(2026, 8, 23, 6, 0); // Tue 23:00 Pacific

  let failed = 0;
  const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) failed++; };

  check("weekday 10:00 is business hours", isBusinessHours(weekday, cfg) === true);
  check("saturday 10am is business hours (seven-day firm)", isBusinessHours(weekend, cfg) === true);
  check("saturday 2am is not business hours", isBusinessHours(Date.UTC(2026, 8, 26, 9, 0), cfg) === false);
  check("weekday 23:00 is not business hours", isBusinessHours(night, cfg) === false);
  check("holiday is not business hours", isBusinessHours(Date.UTC(2026, 10, 26, 18, 0), cfg) === false);

  let r = decideRouting({ language: "en", callerType: "new_client", askedForSeniorManagement: false, at: weekday }, cfg);
  check("new client EN -> intake.en, James", r.list === "intake.en" && r.target?.name === "James");
  r = decideRouting({ language: "es", callerType: "new_client", askedForSeniorManagement: false, at: weekday }, cfg);
  check("new client ES -> intake.es", r.list === "intake.es" && r.callbackWindow === "dentro de la hora");
  r = decideRouting({ language: "en", callerType: "existing_client", askedForSeniorManagement: false, at: weekday }, cfg);
  check("existing client -> admin, Ana", r.list === "admin" && r.target?.name === "Ana");
  r = decideRouting({ language: "en", callerType: "other", askedForSeniorManagement: false, at: weekday }, cfg);
  check("other matter -> admin", r.list === "admin" && r.target?.name === "Ana");
  r = decideRouting({ language: "en", callerType: "existing_client", askedForSeniorManagement: true, requestedPerson: "Walter", at: weekday }, cfg);
  check("asked for Walter -> intake, never admin or Walter", r.list === "intake.en" && r.target?.name === "James" && r.reasons.some((x) => x.includes("Walter")));
  r = decideRouting({ language: "en", callerType: "new_client", askedForSeniorManagement: false, at: night }, cfg);
  check("after hours new client -> overnight, morning callback", r.list === "overnight" && r.callbackWindow === "first thing in the morning");
  r = decideRouting({ language: "en", callerType: "existing_client", at: night }, cfg);
  check("after hours existing client -> overnight intake manager", r.list === "overnight" && r.target?.id === "intake");
  r = decideRouting({ language: "en", callerType: "other", at: night }, cfg);
  check("after hours other matter -> message, no transfer", r.list === "admin" && r.target === null);
  r = decideRouting({ language: "en", callerType: "existing_client", at: night }, { ...cfg, overnight: { handlesExistingClients: false } });
  check("after hours existing client, overnight declines -> message", r.list === "admin" && r.target === null);
  r = decideRouting({ language: "unknown", callerType: "unknown", askedForSeniorManagement: false, at: weekday }, cfg);
  check("unknown -> treated as new client EN", r.list === "intake.en");
  r = decideRouting({ language: "other", callerType: "new_client", askedForSeniorManagement: false, at: weekday }, cfg);
  check("third language -> EN list", r.list === "intake.en" && r.reasons.some((x) => x.includes("third language")));

  console.log(failed ? `\n${failed} check(s) failed` : "\nAll routing checks passed");
  process.exit(failed ? 1 : 0);
}
