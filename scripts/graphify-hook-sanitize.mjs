import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { rewriteHookToDirectSpawn } from "./doctor-hooks.mjs";

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Repair graphify hook commands that graphify's upstream installer wrote as
 * Windows shell-form (`C:\\...\\graphify.EXE hook-guard read`). Claude Code
 * runs shell-form hooks through Git Bash, which consumes those backslashes as
 * escapes and collapses the path to something like `C:UsersKim...`. Rewriting
 * each match into the direct-spawn `command` + `args` form lets Claude Code
 * spawn the executable without a shell boundary, so the path is preserved.
 *
 * No-op outside win32. Backs up the original file before any write. Idempotent.
 *
 * @param {string} settingsPath Absolute path to a settings.json file.
 * @param {{ platform?: string }} [options]
 * @returns {{ changed: boolean, count: number, path: string | null, backup?: string }}
 */
export function sanitizeGraphifyWindowsHooks(settingsPath, options = {}) {
  const runtimePlatform = options.platform ?? process.platform;
  const base = { changed: false, count: 0, path: settingsPath ?? null };
  if (runtimePlatform !== "win32") return base;
  if (!settingsPath || !existsSync(settingsPath)) return base;

  let raw;
  try {
    raw = readFileSync(settingsPath, "utf8");
  } catch {
    return base;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }

  let count = 0;
  const nextHooks = {};
  for (const [event, blocks] of Object.entries(parsed.hooks || {})) {
    nextHooks[event] = (blocks || []).map((block) => ({
      ...block,
      hooks: (block.hooks || []).map((hook) => {
        const rewritten = rewriteHookToDirectSpawn(hook, runtimePlatform);
        if (rewritten) {
          count += 1;
          return rewritten;
        }
        return hook;
      }),
    }));
  }

  if (count === 0) return base;

  const backup = `${settingsPath}.backup-${isoStamp()}`;
  try {
    writeFileSync(backup, raw, "utf8");
  } catch {
    // Best-effort backup; the repair itself still proceeds.
  }
  const next = { ...parsed, hooks: nextHooks };
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { changed: true, count, path: settingsPath, backup };
}
