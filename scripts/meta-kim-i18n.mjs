/**
 * Shared i18n for Meta_Kim installation scripts.
 * Import this from setup.mjs and install-global-skills-all-runtimes.mjs
 * to avoid duplicating strings.
 */

import { platform } from "node:os";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Detect language ──────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function detectLang() {
  const cliIdx = process.argv.indexOf("--lang");
  if (cliIdx >= 0 && process.argv[cliIdx + 1]) {
    return process.argv[cliIdx + 1];
  }
  const envLang = process.env.META_KIM_LANG;
  if (envLang) return envLang;
  // Heuristic: Windows with CJK system → Chinese
  if (platform() === "win32") {
    try {
      const sysLocale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (/^zh/i.test(sysLocale)) return "zh-CN";
      if (/^ja/i.test(sysLocale)) return "ja-JP";
      if (/^ko/i.test(sysLocale)) return "ko-KR";
    } catch {
      // fall through
    }
  }
  return "en";
}

// ── Strings ───────────────────────────────────────────────────

const STRINGS = {
  en: {
    // Skill install (shared)
    dryRun: (cmd) => `[dry-run] ${cmd}`,
    okUpdated: (path) => `[OK] updated ${path}`,
    warnPullFailed: (path) => `[WARN] pull failed, re-cloning ${path}`,
    okCloned: (path) => `[OK] cloned ${path}`,
    skipExists: (path) => `[SKIP] exists ${path}`,
    okBasename: (name, dest) => `[OK] ${name} -> ${dest}`,
    skipNotApplicable: (name, runtime) =>
      `[SKIP] ${name} — not applicable to ${runtime}`,
    // Plugins
    pluginsHeader: "--- Claude Code plugins (user scope) ---",
    warnClaNotFound:
      "claude CLI not found on PATH — skip plugin install. Install Claude Code CLI, then re-run with --plugins-only.",
    skipAlreadyInstalled: (name) => `[SKIP] ${name} — already installed`,
    installingPlugin: (spec) => `Installing plugin: ${spec}`,
    warnPluginFailed: (spec, code) =>
      `[WARN] plugin install failed: ${spec} (exit ${code})`,
    // Python/graphify
    pythonToolsHeader: "--- Python Tools (optional) ---",
    pythonNotFound: "Python 3.10+ not found. Skipping graphify.",
    pythonInstallHint:
      "Install Python 3.10+ and run: pip install graphifyy && python -m graphify claude install",
    skipGraphifyInstalled: (v) => `[SKIP] graphify already installed (${v})`,
    installingGraphify:
      "Installing graphify (code knowledge graph, 71x token compression)...",
    installingGraphifySkill: "Registering graphify Claude skill...",
    okGraphifyInstalled: "graphify installed and Claude skill registered",
    warnGraphifySkillFailed:
      "graphify Claude skill registration failed (non-blocking)",
    warnGraphifyPipFailed: "graphify pip install failed (non-blocking)",
    pythonToolsOptionalHeader: "--- Python Tools (optional) ---",
    pythonNotFoundGraphify: "Python 3.10+ not found. Skipping graphify.",
    pythonInstallHintGraphify:
      "Install Python 3.10+ and run: pip install graphifyy && python -m graphify claude install",
    // Shared i18n keys for install-global-skills
    skillsHeader: (label, root) => `--- ${label}: ${root} ---`,
    failManifestLoad: (err) => `Failed to load skills manifest: ${err}`,
    done: "Done.",
    noteCodexOpenclaw:
      "Note: Codex/OpenClaw have no Claude Code plugin format — same repos are mirrored as skill directories only.",
    activeTargets: (targets) => `Active runtime targets: ${targets.join(", ")}`,
    metaKimRoot: (root) => `Meta_Kim repo (canonical source root): ${root}`,
    warnManifestMissing: "skills manifest missing — no skills to install",
  },
  "zh-CN": {
    dryRun: (cmd) => `[dry-run] ${cmd}`,
    okUpdated: (path) => `[OK] 已更新 ${path}`,
    warnPullFailed: (path) => `[WARN] pull 失败，重新克隆 ${path}`,
    okCloned: (path) => `[OK] 已克隆 ${path}`,
    skipExists: (path) => `[SKIP] 已存在 ${path}`,
    okBasename: (name, dest) => `[OK] ${name} -> ${dest}`,
    skipNotApplicable: (name, runtime) => `[SKIP] ${name} — 不适用 ${runtime}`,
    pluginsHeader: "--- Claude Code 插件（用户范围）---",
    warnClaNotFound:
      "未找到 claude CLI — 跳过插件安装。请先安装 Claude Code CLI，然后运行 --plugins-only。",
    skipAlreadyInstalled: (name) => `[SKIP] ${name} — 已安装`,
    installingPlugin: (spec) => `正在安装插件：${spec}`,
    warnPluginFailed: (spec, code) =>
      `[WARN] 插件安装失败：${spec}（退出码 ${code}）`,
    pythonToolsHeader: "--- Python 工具（可选）---",
    pythonNotFound: "未找到 Python 3.10+，跳过 graphify。",
    pythonInstallHint:
      "安装 Python 3.10+ 后运行：pip install graphifyy && python -m graphify claude install",
    skipGraphifyInstalled: (v) => `[SKIP] graphify 已安装 (${v})`,
    installingGraphify: "正在安装 graphify（代码知识图谱，71x token 压缩）...",
    installingGraphifySkill: "正在注册 graphify Claude 技能...",
    okGraphifyInstalled: "graphify 已安装，Claude 技能已注册",
    warnGraphifySkillFailed: "graphify Claude 技能注册失败（不影响其他功能）",
    warnGraphifyPipFailed: "graphify pip 安装失败（不影响其他功能）",
    skillsHeader: (label, root) => `--- ${label}：${root} ---`,
    failManifestLoad: (err) => `加载技能清单失败：${err}`,
    done: "完成。",
    noteCodexOpenclaw:
      "注意：Codex/OpenClaw 没有 Claude Code 插件格式——同名仓库只作为技能目录镜像。",
    activeTargets: (targets) => `活跃运行时目标：${targets.join(", ")}`,
    metaKimRoot: (root) => `Meta_Kim 仓库（正典源根目录）：${root}`,
    warnManifestMissing: "缺少技能清单 — 无技能可安装",
    pythonToolsOptionalHeader: "--- Python 工具（可选）---",
    pythonNotFoundGraphify: "未找到 Python 3.10+，跳过 graphify。",
    pythonInstallHintGraphify:
      "安装 Python 3.10+ 后运行：pip install graphifyy && python -m graphify claude install",
  },
  "ja-JP": {
    dryRun: (cmd) => `[dry-run] ${cmd}`,
    okUpdated: (path) => `[OK] 更新済み ${path}`,
    warnPullFailed: (path) => `[WARN] pull 失敗、再クローン ${path}`,
    okCloned: (path) => `[OK] クローン済み ${path}`,
    skipExists: (path) => `[SKIP] 存在 ${path}`,
    okBasename: (name, dest) => `[OK] ${name} -> ${dest}`,
    skipNotApplicable: (name, runtime) =>
      `[SKIP] ${name} — ${runtime} に適用外`,
    pluginsHeader: "--- Claude Code プラグイン（ユーザー範囲）---",
    warnClaNotFound:
      "claude CLI が見つかりません — プラグインインストールをスキップ。Claude Code CLI をインストール後、--plugins-only を再実行してください。",
    skipAlreadyInstalled: (name) => `[SKIP] ${name} — インストール済み`,
    installingPlugin: (spec) => `プラグインをインストール中：${spec}`,
    warnPluginFailed: (spec, code) =>
      `[WARN] プラグインインストール失敗：${spec}（終了 ${code}）`,
    pythonToolsHeader: "--- Python ツール（オプション）---",
    pythonNotFound: "Python 3.10+ が見つかりません — graphify をスキップ。",
    pythonInstallHint:
      "Python 3.10+ インストール後：pip install graphifyy && python -m graphify claude install",
    skipGraphifyInstalled: (v) => `[SKIP] graphify インストール済み (${v})`,
    installingGraphify:
      "graphify をインストール中（コードナレッジグラフ、71x トークン圧縮）...",
    installingGraphifySkill: "graphify Claude スキルを登録中...",
    okGraphifyInstalled: "graphify インストール完了、Claude スキル登録済み",
    warnGraphifySkillFailed: "graphify Claude スキル登録失敗（非ブロッキング）",
    warnGraphifyPipFailed: "graphify pip インストール失敗（非ブロッキング）",
    skillsHeader: (label, root) => `--- ${label}：${root} ---`,
    failManifestLoad: (err) => `スキルマニフェストの読み込みに失敗：${err}`,
    done: "完了。",
    noteCodexOpenclaw:
      "注意：Codex/OpenClaw には Claude Code プラグイン形式がありません — 同じリポジトリはスキルディレクトリとしてのみミラーリングされます。",
    activeTargets: (targets) =>
      `アクティブランタイムターゲット：${targets.join(", ")}`,
    metaKimRoot: (root) => `Meta_Kim リポジトリ（正典ソースルート）：${root}`,
    warnManifestMissing:
      "スキルマニフェストが見つかりません — インストールするスキルがありません",
    pythonToolsOptionalHeader: "--- Python ツール（オプション）---",
    pythonNotFoundGraphify:
      "Python 3.10+ が見つかりません — graphify をスキップ。",
    pythonInstallHintGraphify:
      "Python 3.10+ インストール後：pip install graphifyy && python -m graphify claude install",
  },
  "ko-KR": {
    dryRun: (cmd) => `[dry-run] ${cmd}`,
    okUpdated: (path) => `[OK] 업데이트됨 ${path}`,
    warnPullFailed: (path) => `[WARN] pull 실패, 재클론 ${path}`,
    okCloned: (path) => `[OK] 클론됨 ${path}`,
    skipExists: (path) => `[SKIP] 존재함 ${path}`,
    okBasename: (name, dest) => `[OK] ${name} -> ${dest}`,
    skipNotApplicable: (name, runtime) =>
      `[SKIP] ${name} — ${runtime}에 적용 불가`,
    pluginsHeader: "--- Claude Code 플러그인 (사용자 범위) ---",
    warnClaNotFound:
      "claude CLI를 찾을 수 없음 — 플러그인 설치 건너뜀. Claude Code CLI를 설치한 후 --plugins-only를 다시 실행하세요.",
    skipAlreadyInstalled: (name) => `[SKIP] ${name} — 이미 설치됨`,
    installingPlugin: (spec) => `플러그인 설치 중：${spec}`,
    warnPluginFailed: (spec, code) =>
      `[WARN] 플러그인 설치 실패：${spec}（종료 코드 ${code}）`,
    pythonToolsHeader: "--- Python 도구 (선택) ---",
    pythonNotFound: "Python 3.10+ 없음 — graphify 건너뜀.",
    pythonInstallHint:
      "Python 3.10+ 설치 후: pip install graphifyy && python -m graphify claude install",
    skipGraphifyInstalled: (v) => `[SKIP] graphify 이미 설치됨 (${v})`,
    installingGraphify: "graphify 설치 중 (코드 지식 그래프, 71x 토큰 압축)...",
    installingGraphifySkill: "graphify Claude 스킬 등록 중...",
    okGraphifyInstalled: "graphify 설치 완료, Claude 스킬 등록됨",
    warnGraphifySkillFailed: "graphify Claude 스킬 등록 실패 (비차단)",
    warnGraphifyPipFailed: "graphify pip 설치 실패 (비차단)",
    skillsHeader: (label, root) => `--- ${label}：${root} ---`,
    failManifestLoad: (err) => `스킬 매니페스트 로드 실패：${err}`,
    done: "완료.",
    noteCodexOpenclaw:
      "참고: Codex/OpenClaw에는 Claude Code 플러그인 형식이 없습니다 — 동일한 저장소는 스킬 디렉토리로만 미러링됩니다.",
    activeTargets: (targets) => `활성 런타임 대상：${targets.join(", ")}`,
    metaKimRoot: (root) => `Meta_Kim 저장소 (정본 소스 루트)：${root}`,
    warnManifestMissing: "스킬 매니페스트 누락 — 설치할 스킬이 없습니다",
    pythonToolsOptionalHeader: "--- Python 도구 (선택) ---",
    pythonNotFoundGraphify: "Python 3.10+ 없음 — graphify 건너뜀.",
    pythonInstallHintGraphify:
      "Python 3.10+ 설치 후: pip install graphifyy && python -m graphify claude install",
  },
};

const LANG = detectLang();
const t = STRINGS[LANG] || STRINGS.en;

export { t, LANG };
