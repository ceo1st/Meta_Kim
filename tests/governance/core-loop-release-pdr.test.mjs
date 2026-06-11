import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PDR_PATH = "docs/pdr/current-core-loop-release.md";
const pdr = readFileSync(PDR_PATH, "utf8");
const scriptsReadme = readFileSync("scripts/README.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("core-loop release PDR maps acceptance items to evidence", () => {
  assert.match(pdr, /Status: In Progress|Status: Done|Status: Partial|Status: Blocked/);
  assert.match(pdr, /Default spine:/);
  assert.match(pdr, /Critical -> Fetch -> Thinking -> Execution -> Review -> Meta-Review -> Verification -> Evolution/);

  for (let index = 1; index <= 13; index += 1) {
    assert.match(pdr, new RegExp(`\\| A${index} \\|`), `PDR missing A${index}`);
  }

  for (const evidence of [
    "config/contracts/core-loop-contract.json",
    "npm run meta:theory:run",
    "npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-core-loop-release-run.json",
    "npm run meta:capabilities:index",
    "npm run meta:verify:all",
    "git diff --check",
  ]) {
    assert.ok(pdr.includes(evidence), `PDR missing evidence ${evidence}`);
  }
});

test("release verification path includes governance tests", () => {
  assert.match(packageJson.scripts["meta:verify:all"], /npm run meta:verify:governance/);
  assert.match(packageJson.scripts["meta:verify:governance"], /npm run meta:test:governance/);
  assert.match(packageJson.scripts["meta:verify:all"], /npm run meta:graphify:check/);
  assert.match(packageJson.scripts["meta:verify:all"], /node scripts\/eval-meta-agents\.mjs --require-all-runtimes/);
});

test("script registry classifies scripts and protects cleanup candidates", () => {
  for (const bucket of [
    "Core engines",
    "Product/report generators",
    "Runtime evidence",
    "Sync/install/release",
    "Validators",
    "Doctor/status utilities",
    "Shared helpers",
  ]) {
    assert.ok(scriptsReadme.includes(bucket), `scripts README missing bucket ${bucket}`);
  }

  for (const candidate of [
    "scripts/agent-health-report.mjs",
    "scripts/check-release-notes-consistency.mjs",
    "scripts/meta-kim-aggregate.mjs",
  ]) {
    assert.ok(scriptsReadme.includes(candidate), `scripts README missing cleanup candidate ${candidate}`);
  }

  assert.match(scriptsReadme, /Do not prune scripts by filename count alone/);
  assert.match(scriptsReadme, /Before removing one, check changelog history, release notes/);
});
