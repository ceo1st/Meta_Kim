#!/usr/bin/env node
/**
 * Cross-runtime install: clone the same third-party skill repos into
 * ~/.claude/skills, ~/.codex/skills, and ~/.openclaw/skills (plus optional
 * `claude plugin install …` for bundles that ship as official CC plugins).
 *
 * Flags:
 *   --update          git pull / re-clone skill dirs
 *   --dry-run         print actions only
 *   --plugins-only    only run `claude plugin install` (no git clones)
 *   --skip-plugins    skip `claude plugin install` even if defaults apply
 *
 * Env (optional): META_KIM_CLAUDE_HOME, CLAUDE_HOME, META_KIM_CODEX_HOME,
 * CODEX_HOME, META_KIM_OPENCLAW_HOME, OPENCLAW_HOME
 */

import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const updateMode = process.argv.includes("--update");
const dryRun = process.argv.includes("--dry-run");
const pluginsOnly = process.argv.includes("--plugins-only");
const skipPlugins =
  process.argv.includes("--skip-plugins") || process.argv.includes("--no-plugins");

/**
 * Keep in sync with install-deps.sh / setup.mjs.
 * Use `subdir` when the installable skill lives under a path like skills/<name>/ (repo root has no SKILL.md).
 * Note: Hooks in SKILL frontmatter only apply once the skill is discoverable. User-level commands under
 * a repo’s .claude/commands are not merged by cloning into ~/.claude/skills/<id> — use `claude plugin install`
 * for plugin bundles (e.g. superpowers@claude-plugins-official).
 */
const SKILL_REPOS = [
  { id: "agent-teams-playbook", repo: "https://github.com/KimYx0207/agent-teams-playbook.git" },
  { id: "findskill", repo: "https://github.com/KimYx0207/findskill.git" },
  { id: "hookprompt", repo: "https://github.com/KimYx0207/HookPrompt.git" },
  { id: "superpowers", repo: "https://github.com/obra/superpowers.git" },
  { id: "everything-claude-code", repo: "https://github.com/affaan-m/everything-claude-code.git" },
  {
    id: "planning-with-files",
    repo: "https://github.com/OthmanAdi/planning-with-files.git",
    subdir: "skills/planning-with-files",
  },
  { id: "cli-anything", repo: "https://github.com/HKUDS/CLI-Anything.git" },
  { id: "gstack", repo: "https://github.com/garrytan/gstack.git" },
];

/** Official marketplace plugins (full bundle: commands + skills + hooks when upstream provides). */
const CLAUDE_PLUGIN_SPECS = ["superpowers@claude-plugins-official"];

function runtimeDir(envKeys, fallbackName) {
  for (const key of envKeys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim()) {
      return path.resolve(v.trim());
    }
  }
  return path.join(os.homedir(), fallbackName);
}

function resolveHomes() {
  return {
    claude: runtimeDir(["META_KIM_CLAUDE_HOME", "CLAUDE_HOME"], ".claude"),
    codex: runtimeDir(["META_KIM_CODEX_HOME", "CODEX_HOME"], ".codex"),
    openclaw: runtimeDir(["META_KIM_OPENCLAW_HOME", "OPENCLAW_HOME"], ".openclaw"),
  };
}

function assertUnderHome(resolved) {
  const home = path.resolve(os.homedir());
  const abs = path.resolve(resolved);
  if (abs !== home && !abs.startsWith(`${home}${path.sep}`)) {
    throw new Error(`Refusing to write outside user home: ${abs}`);
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function runGit(args, opts = {}) {
  if (dryRun) {
    console.log(`[dry-run] git ${args.join(" ")}`);
    return;
  }
  execFileSync("git", args, { stdio: "inherit", ...opts });
}

async function installGitSkill(targetDir, repoUrl) {
  assertUnderHome(targetDir);
  if (await pathExists(targetDir)) {
    if (updateMode) {
      if (dryRun) {
        console.log(`[dry-run] update ${targetDir}`);
        return;
      }
      try {
        runGit(["-C", targetDir, "pull", "--ff-only"]);
        console.log(`[OK] updated ${targetDir}`);
      } catch {
        console.warn(`[WARN] pull failed, re-cloning ${targetDir}`);
        await fs.rm(targetDir, { recursive: true, force: true });
        runGit(["clone", "--depth", "1", repoUrl, targetDir]);
        console.log(`[OK] cloned ${targetDir}`);
      }
    } else {
      console.log(`[SKIP] exists ${targetDir}`);
    }
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] clone ${repoUrl} -> ${targetDir}`);
    return;
  }
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  runGit(["clone", "--depth", "1", repoUrl, targetDir]);
  console.log(`[OK] cloned ${targetDir}`);
}

async function installGitSkillFromSubdir(targetDir, repoUrl, subdirPath) {
  assertUnderHome(targetDir);
  if ((await pathExists(targetDir)) && !updateMode) {
    console.log(`[SKIP] exists ${targetDir}`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] sparse install ${repoUrl} (${subdirPath}) -> ${targetDir}`);
    return;
  }

  if ((await pathExists(targetDir)) && updateMode) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "meta-kim-skill-"));
  try {
    runGit(["clone", "--depth", "1", "--filter=blob:none", "--sparse", repoUrl, tmp]);
    runGit(["sparse-checkout", "set", subdirPath], { cwd: tmp });
    const src = path.join(tmp, ...subdirPath.split("/").filter(Boolean));
    if (!(await pathExists(src))) {
      throw new Error(`Sparse checkout path missing after clone: ${src}`);
    }
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(src, targetDir, { recursive: true, force: true });
    console.log(`[OK] ${path.basename(targetDir)} -> ${targetDir} (from ${subdirPath})`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function installSkillCreator(targetBaseSkills) {
  const id = "skill-creator";
  const targetDir = path.join(targetBaseSkills, id);
  assertUnderHome(targetDir);

  if ((await pathExists(targetDir)) && !updateMode) {
    console.log(`[SKIP] exists ${targetDir}`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] sparse install skill-creator -> ${targetDir}`);
    return;
  }

  if ((await pathExists(targetDir)) && updateMode) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "meta-kim-skill-"));
  try {
    runGit(
      ["clone", "--depth", "1", "--filter=blob:none", "--sparse", "https://github.com/anthropics/skills.git", tmp],
      { cwd: undefined }
    );
    runGit(["sparse-checkout", "set", "skills/skill-creator"], { cwd: tmp });
    await fs.mkdir(targetBaseSkills, { recursive: true });
    await fs.cp(path.join(tmp, "skills", "skill-creator"), targetDir, {
      recursive: true,
      force: true,
    });
    console.log(`[OK] skill-creator -> ${targetDir}`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function installAllSkillsForRuntime(label, skillsRoot) {
  console.log(`\n--- ${label}: ${skillsRoot} ---`);
  assertUnderHome(skillsRoot);
  if (!dryRun) {
    await fs.mkdir(skillsRoot, { recursive: true });
  }

  for (const spec of SKILL_REPOS) {
    const targetDir = path.join(skillsRoot, spec.id);
    if (spec.subdir) {
      await installGitSkillFromSubdir(targetDir, spec.repo, spec.subdir);
    } else {
      await installGitSkill(targetDir, spec.repo);
    }
  }
  await installSkillCreator(skillsRoot);
}

function installClaudePlugins() {
  if (skipPlugins || CLAUDE_PLUGIN_SPECS.length === 0) {
    return;
  }
  console.log("\n--- Claude Code plugins (user scope) ---");
  const r = spawnSync("claude", ["--version"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.warn(
      "[WARN] `claude` CLI not found on PATH — skip plugin install. Install Claude Code CLI, then re-run with --plugins-only."
    );
    return;
  }

  for (const spec of CLAUDE_PLUGIN_SPECS) {
    if (dryRun) {
      console.log(`[dry-run] claude plugin install ${spec}`);
      continue;
    }
    console.log(`Installing plugin: ${spec}`);
    const p = spawnSync("claude", ["plugin", "install", spec], {
      stdio: "inherit",
      shell: os.platform() === "win32",
    });
    if (p.status !== 0) {
      console.warn(`[WARN] plugin install failed: ${spec} (exit ${p.status})`);
    }
  }
}

async function main() {
  const homes = resolveHomes();

  if (!pluginsOnly) {
    await installAllSkillsForRuntime("Claude Code skills", path.join(homes.claude, "skills"));
    await installAllSkillsForRuntime("Codex skills", path.join(homes.codex, "skills"));
    await installAllSkillsForRuntime("OpenClaw skills", path.join(homes.openclaw, "skills"));
  }

  installClaudePlugins();

  console.log("\nDone.");
  console.log(
    "Note: Codex/OpenClaw have no Claude Code plugin format — same repos are mirrored as skill directories only."
  );
  console.log(`Meta_Kim repo (canonical agents/skills): ${repoRoot}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
