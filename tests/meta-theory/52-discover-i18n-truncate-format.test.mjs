import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

function scan(langFlag = "--zh") {
  const args = ["scripts/discover-global-capabilities.mjs"];
  if (langFlag) args.push(langFlag);
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status !== 0 && result.status !== null) {
    if (result.stderr && result.stderr.trim()) {
      throw new Error(`script failed: ${result.stderr}`);
    }
  }
  return result.stdout;
}

describe("52 — Discover capabilities i18n truncate format", () => {
  test("zh output uses 剩余 N 项因篇幅关系未显示 wording", () => {
    const out = scan();
    assert.match(out, /剩余 \d+ 项因篇幅关系未显示/, "zh output must use 因篇幅关系未显示 wording");
  });

  test("zh output shows at least 10 family names before truncation", () => {
    const out = scan();
    // Match the Skills-by-family line (contains "vercel" or similar short family tokens), not the by-platform total line
    const familyLine = out.split("\n").find((l) => /\bvercel\s+\d+/.test(l));
    assert.ok(familyLine, "expected a Skills family line containing 'vercel N'");
    const body = familyLine.split(/\s*等\s*|,\s*more/)[0];
    const familyNames = body.split(/,\s*/).filter((s) => /\s\d+$/.test(s));
    assert.ok(familyNames.length >= 10, `expected >=10 visible families, got ${familyNames.length}`);
  });

  test("zh output does not use old 项未显示 wording", () => {
    const out = scan();
    assert.doesNotMatch(out, /项未显示/, "old 项未显示 wording should be replaced");
  });
});