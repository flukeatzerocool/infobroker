// @implements REQ-105
// User-configuration-layer migration (REQ-105). Detects entries in the user
// layer that no longer match the shipped schema and relocates registered legacy
// keys, without ever discarding entries the current schema does not recognize.
// Detection is read-only; application is explicit and driven by the caller. The
// user layer is versioned with `config_version`; an absent version is treated as
// "unversioned" rather than zero, so a user who never sets it is not nagged
// about a migration it does not need.

export const CURRENT_CONFIG_VERSION = 1;

export interface RenameMigration {
  from: string;
  to: string;
}

export interface DeprecatedKey {
  path: string;
  replacement: string;
}

// Registered key relocations applied to the user layer. Empty until a release
// renames a shipped config key; the engine's transform path is exercised by
// tests with injected entries, and the deprecation surface below is live.
export const RENAME_MIGRATIONS: readonly RenameMigration[] = [];

// Legacy user-layer keys that are superseded but cannot be transformed without
// changing behavior (the replacement shape carries information the old key
// lacks). These are reported for manual migration, never rewritten.
export const DEPRECATED_KEYS: readonly DeprecatedKey[] = [
  { path: "kb.expiry", replacement: "kb.freshness tiers (per-tier decay and expiry)" },
];

export interface ConfigDrift {
  declaredVersion: number | null;
  currentVersion: number;
  outdatedVersion: boolean;
  renames: RenameMigration[];
  deprecated: DeprecatedKey[];
  unrecognized: string[];
  hasDrift: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(cur[part])) cur[part] = {};
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function deletePath(obj: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(cur[part])) return;
    cur = cur[part] as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]];
}

/**
 * Read-only drift assessment. `shippedTopLevel` is the set of top-level keys in
 * the shipped default config; a user-layer top-level key outside that set (and
 * not `config_version`) is reported as unrecognized. Nested unrecognized keys
 * are intentionally not reported — provider slugs, dispatch task types, and
 * policy categories are legitimately user-defined.
 */
export function detectConfigDrift(
  userLayer: Record<string, unknown>,
  shippedTopLevel: readonly string[],
  migrations: readonly RenameMigration[] = RENAME_MIGRATIONS
): ConfigDrift {
  const declared =
    typeof userLayer["config_version"] === "number" ? (userLayer["config_version"] as number) : null;

  const renames = migrations.filter((m) => getPath(userLayer, m.from) !== undefined);
  const deprecated = DEPRECATED_KEYS.filter((d) => getPath(userLayer, d.path) !== undefined);

  const known = new Set(shippedTopLevel);
  known.add("config_version");
  const unrecognized = Object.keys(userLayer).filter((k) => !known.has(k));

  const outdatedVersion = declared !== null && declared < CURRENT_CONFIG_VERSION;
  const hasDrift =
    renames.length > 0 || deprecated.length > 0 || unrecognized.length > 0 || outdatedVersion;

  return {
    declaredVersion: declared,
    currentVersion: CURRENT_CONFIG_VERSION,
    outdatedVersion,
    renames,
    deprecated,
    unrecognized,
    hasDrift,
  };
}

/**
 * Apply the registered key relocations and stamp the current schema version.
 * Returns a new layer (the input is not mutated) plus a human-readable list of
 * applied changes. When a target key already holds a user value, the user's
 * value wins and the legacy duplicate is dropped, so the migration is
 * idempotent. Unrecognized keys are copied through untouched.
 */
export function applyConfigMigrations(
  userLayer: Record<string, unknown>,
  drift: ConfigDrift
): { layer: Record<string, unknown>; changes: string[] } {
  const layer: Record<string, unknown> = JSON.parse(JSON.stringify(userLayer));
  const changes: string[] = [];

  for (const rename of drift.renames) {
    const value = getPath(layer, rename.from);
    if (value === undefined) continue;
    if (getPath(layer, rename.to) === undefined) {
      setPath(layer, rename.to, value);
      changes.push(`moved "${rename.from}" → "${rename.to}"`);
    } else {
      changes.push(`dropped legacy "${rename.from}" (user value at "${rename.to}" takes precedence)`);
    }
    deletePath(layer, rename.from);
  }

  // Stamp the current schema version when the layer is unversioned or written
  // for an older schema. A clean layer already at the current version yields no
  // changes, so an explicit migrate call is a no-op for it.
  if (drift.declaredVersion !== CURRENT_CONFIG_VERSION) {
    layer["config_version"] = CURRENT_CONFIG_VERSION;
    changes.push(`stamped config_version=${CURRENT_CONFIG_VERSION}`);
  }

  return { layer, changes };
}
