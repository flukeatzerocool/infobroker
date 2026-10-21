// checks.mjs — Pure evaluators for a skill manifest's optional `checks`.
// The caller supplies the before/after workdir text and the assistant text;
// this module performs no I/O so the gating rules are unit-testable.
//
// `checks.advisory` is a name -> reason map. A failed advisory check is
// reported but excluded from `passed`, so an unreliable check can stay
// visible without making the strict audit gate red.

export function evaluateChecks(manifest, text, { before = null, after = null } = {}) {
  const checks = manifest?.checks;
  if (!checks) return null;

  const advisory = checks.advisory && typeof checks.advisory === "object" ? checks.advisory : {};
  const results = {};
  const failed = [];
  const advisoryFailed = [];

  const record = (name, ok, detail) => {
    results[name] = ok;
    if (ok) return;
    const message = detail ? `${name}: ${detail}` : name;
    if (Object.prototype.hasOwnProperty.call(advisory, name)) advisoryFailed.push(message);
    else failed.push(message);
  };

  if (checks.require_file_change) {
    record(
      "require_file_change",
      before !== null && after !== null && before !== after,
      before === null || after === null ? "workdir input missing" : "file unchanged"
    );
  }

  for (const name of ["must_be_absent", "must_be_preserved"]) {
    const items = checks[name];
    if (!Array.isArray(items) || items.length === 0) continue;
    const bad = items.filter((item) =>
      after === null ? true : name === "must_be_absent" ? after.includes(item) : !after.includes(item)
    );
    record(name, bad.length === 0, bad.join(", "));
  }

  const lower = text.replace(/[*`~]/g, "").toLowerCase();
  const includesAny = (pattern) =>
    pattern.toLowerCase().split("|").some((alt) => alt.length > 0 && lower.includes(alt));

  if (Array.isArray(checks.required_facts) && checks.required_facts.length > 0) {
    const missing = checks.required_facts.filter((fact) => !includesAny(fact));
    record("required_facts", missing.length === 0, missing.join(", "));
  }

  if (Array.isArray(checks.required_any) && checks.required_any.length > 0) {
    record(
      "required_any",
      checks.required_any.some((pattern) => includesAny(pattern)),
      `none of: ${checks.required_any.join(", ")}`
    );
  }

  if (Array.isArray(checks.forbidden_patterns) && checks.forbidden_patterns.length > 0) {
    const found = checks.forbidden_patterns.filter((pattern) => lower.includes(pattern.toLowerCase()));
    record("forbidden_patterns", found.length === 0, found.join(", "));
  }

  return {
    passed: failed.length === 0,
    failed,
    advisory_failed: advisoryFailed,
    advisory,
    file_changed: before !== null && after !== null && before !== after,
    results,
  };
}
