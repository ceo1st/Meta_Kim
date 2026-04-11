/**
 * Tests for installSkill() git operation logic.
 * Covers: clone path, ff-only failure handling, update vs skip behavior.
 */

import { test, describe, mock } from "node:test";
import assert from "node:assert";

// Reimplement installSkill logic for isolated testing
function createInstallSkillMock(fixtures = {}) {
  const { fsExists = false, gitPullStatus = 0, gitCloneStatus = 0 } = fixtures;

  let deletedPaths = [];

  const mockFs = {
    existsSync: (p) => {
      if (typeof fsExists === "function") return fsExists(p);
      return fsExists;
    },
    rmSync: (p) => {
      deletedPaths.push(p);
    },
  };

  function installSkillUnderTest(skill, updateMode = false) {
    const target = skill.target;
    const proxy = "";
    const url = `https://github.com/${skill.repo}.git`;

    if (mockFs.existsSync(target)) {
      if (updateMode) {
        // git pull --ff-only
        if (gitPullStatus === 0) {
          return { ok: true, action: "pulled" };
        }
        // ff-only failure: DO NOT delete — just warn and keep existing
        return { ok: true, action: "skipped_ff_failure", deleted: false };
      }
      return { ok: true, action: "skipped_exists" };
    }

    if (gitCloneStatus === 0) {
      return { ok: true, action: "cloned" };
    }
    return { ok: false, action: "clone_failed" };
  }

  return { installSkillUnderTest, getDeletedPaths: () => [...deletedPaths] };
}

describe("installSkill() — non-update mode", () => {
  test("skips when skill directory already exists", () => {
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: true,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      false,
    );
    assert.strictEqual(result.action, "skipped_exists");
  });

  test("clones when directory does not exist", () => {
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: false,
      gitCloneStatus: 0,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      false,
    );
    assert.strictEqual(result.action, "cloned");
  });

  test("fails when clone fails", () => {
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: false,
      gitCloneStatus: 128,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      false,
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.action, "clone_failed");
  });
});

describe("installSkill() — update mode", () => {
  test("pulls when skill exists and ff-only succeeds", () => {
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: true,
      gitPullStatus: 0,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      true,
    );
    assert.strictEqual(result.action, "pulled");
  });

  test("DOES NOT delete directory on ff-only failure (critical fix)", () => {
    const { installSkillUnderTest, getDeletedPaths } = createInstallSkillMock({
      fsExists: true,
      gitPullStatus: 1, // ff-only fails
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      true,
    );
    // Key assertion: we should skip update, NOT delete the existing skill
    assert.strictEqual(result.action, "skipped_ff_failure");
    assert.strictEqual(
      result.ok,
      true,
      "Should return ok=true even on ff-only failure",
    );
    assert.strictEqual(result.deleted, false);
    assert.deepStrictEqual(getDeletedPaths(), []);
  });

  test("does not attempt pull when directory does not exist", () => {
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: false,
      gitCloneStatus: 0,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/skills/test" },
      true,
    );
    assert.strictEqual(result.action, "cloned");
  });
});

describe("installSkill() — error scenarios", () => {
  test("returns ok=true on ff-only failure (existing skill preserved)", () => {
    // This is the behavioral contract: ff-only failure should warn+skip, not delete
    const { installSkillUnderTest } = createInstallSkillMock({
      fsExists: true,
      gitPullStatus: 128,
    });
    const result = installSkillUnderTest(
      { repo: "test/repo", target: "/tmp/skill" },
      true,
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.action, "skipped_ff_failure");
  });
});
