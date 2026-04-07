#!/usr/bin/env bash
# Meta_Kim 元技能依赖安装脚本
# 将 9 个放大 agent 能力的元技能安装到全局 ~/.claude/skills/
#
# 跨平台 / 三端 skills + 可选 Claude Code 官方 plugin：
#   npm run deps:install:all-runtimes
# （Codex ~/.codex/skills、OpenClaw ~/.openclaw/skills、并尝试 claude plugin install）

set -e

SKILLS_DIR="$HOME/.claude/skills"
PROXY="${HTTPS_PROXY:-${HTTP_PROXY:-}}"
GIT_PROXY_FLAGS=""
UPDATE_MODE="false"

# Parse arguments
if [ "${1:-}" = "--update" ] || [ "${1:-}" = "-u" ]; then
  UPDATE_MODE="true"
fi

if [ -n "$PROXY" ]; then
  GIT_PROXY_FLAGS="-c http.proxy=$PROXY -c https.proxy=$PROXY"
  echo "Using proxy: $PROXY"
fi

mkdir -p "$SKILLS_DIR"
PROJECT_SKILL_OWNER="${META_KIM_SKILL_OWNER:-KimYx0207}"

install_skill() {
  local name="$1"
  local repo="$2"
  local target="$SKILLS_DIR/$name"

  if [ -d "$target" ]; then
    if [ "$UPDATE_MODE" = "true" ]; then
      echo "  [UPDATE] $name — pulling latest"
      (cd "$target" && git $GIT_PROXY_FLAGS pull --ff-only 2>/dev/null) || {
        echo "  [WARN] $name — pull failed, re-cloning"
        rm -rf "$target"
        git $GIT_PROXY_FLAGS clone --depth 1 "https://github.com/$repo.git" "$target" 2>/dev/null
      }
      echo "  [OK] $name updated"
    else
      echo "  [SKIP] $name — already installed at $target"
    fi
    return
  fi

  echo "  [INSTALL] $name from $repo"
  git $GIT_PROXY_FLAGS clone --depth 1 "https://github.com/$repo.git" "$target" 2>/dev/null
  echo "  [OK] $name installed"
}

install_skill_from_subdir() {
  local name="$1"
  local repo="$2"
  local subdir="$3"
  local target="$SKILLS_DIR/$name"

  if [ -d "$target" ]; then
    if [ "$UPDATE_MODE" = "true" ]; then
      echo "  [UPDATE] $name — re-fetching from $repo (subdir: $subdir)"
      rm -rf "$target"
    else
      echo "  [SKIP] $name — already installed at $target"
      return
    fi
  fi

  echo "  [INSTALL] $name from $repo (subdir: $subdir)"
  local tmpdir
  tmpdir=$(mktemp -d)
  git $GIT_PROXY_FLAGS clone --depth 1 --filter=blob:none --sparse \
    "https://github.com/$repo.git" "$tmpdir" 2>/dev/null
  (cd "$tmpdir" && git sparse-checkout set "$subdir" 2>/dev/null)
  cp -r "$tmpdir/$subdir" "$target"
  rm -rf "$tmpdir"
  echo "  [OK] $name installed"
}

echo ""
echo "========================================="
if [ "$UPDATE_MODE" = "true" ]; then
  echo "  Meta_Kim 元技能依赖更新"
else
  echo "  Meta_Kim 元技能依赖安装"
fi
echo "========================================="
echo ""

echo "--- 项目默认依赖 ---"
install_skill "agent-teams-playbook" "$PROJECT_SKILL_OWNER/agent-teams-playbook"
# findskill：仓库根无 SKILL.md；上游提供 original/（macOS、Linux、*BSD、WSL 等）与 windows/（本机 Windows / Git Bash·MSYS·Cygwin）。
# 安装目标仍是 ~/.claude/skills/findskill/，与其它技能目录隔离。
FINDSKILL_SUBDIR="original"
uname_s="$(uname -s 2>/dev/null || echo unknown)"
case "$uname_s" in
  MINGW*|MSYS*|CYGWIN*) FINDSKILL_SUBDIR="windows" ;;
esac
install_skill_from_subdir "findskill" "$PROJECT_SKILL_OWNER/findskill" "$FINDSKILL_SUBDIR"
install_skill "hookprompt"           "$PROJECT_SKILL_OWNER/HookPrompt"

echo ""
echo "--- 社区高星项目 ---"
install_skill "superpowers"            "obra/superpowers"
install_skill "everything-claude-code" "affaan-m/everything-claude-code"
# SKILL.md lives under skills/planning-with-files/ (not repo root). Whole-repo clone breaks CC discovery.
install_skill_from_subdir "planning-with-files" "OthmanAdi/planning-with-files" "skills/planning-with-files"
install_skill "cli-anything"           "HKUDS/CLI-Anything"
install_skill "gstack"                 "garrytan/gstack"

echo ""
echo "--- Anthropic 官方 ---"
install_skill_from_subdir "skill-creator" "anthropics/skills" "skills/skill-creator"

echo ""
echo "========================================="
echo "  Done! 9 meta-skills installed to $SKILLS_DIR"
echo "========================================="
echo ""
echo "Installed skills:"
ls -d "$SKILLS_DIR"/agent-teams-playbook "$SKILLS_DIR"/findskill "$SKILLS_DIR"/hookprompt \
      "$SKILLS_DIR"/superpowers "$SKILLS_DIR"/everything-claude-code \
      "$SKILLS_DIR"/planning-with-files "$SKILLS_DIR"/cli-anything \
      "$SKILLS_DIR"/gstack \
      "$SKILLS_DIR"/skill-creator 2>/dev/null || true
