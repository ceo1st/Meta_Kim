# QUICKSTART

Meta_Kim 快速上手指南。

---

## 1. 项目简介

**Meta_Kim** 是一个 AI 治理系统，为 Claude Code / Codex / OpenClaw / Cursor 等 AI 编程助手提供统一的 governance layer。核心原则：

> 先明确要做什么 -> 再决定谁来做 -> 执行后 review -> 保留学习成果 -> 反馈到下次运行。

**一句话**: AI 的 AI，让 AI 的工作不失控。

---

## 2. 安装（3 步）

### 方式 A：交互式安装（推荐）

```bash
git clone https://github.com/KimYx0207/Meta_Kim.git
cd Meta_Kim
node setup.mjs
```

或使用 npm：

```bash
npm run meta:setup:install
```

### 方式 B：仅同步运行时（已克隆项目）

```bash
npm run meta:sync          # 同步 canonical -> .claude/ .codex/ 等
npm run meta:validate       # 验证项目完整性
```

### 方式 C：一键尝鲜

```bash
npx --yes github:KimYx0207/Meta_Kim meta-kim
```

---

## 3. 基础用法示例

### 示例 1：同步运行时文件

修改 `canonical/` 下的 agent 或 skill 后，重新同步到各运行时：

```bash
npm run meta:sync
```

### 示例 2：运行 governance 自检

检查 contract、hook 命令、镜像同步是否正常：

```bash
npm run meta:doctor:governance
```

### 示例 3：验证 run artifact

本地测试 governance 记录是否合规：

```bash
npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-run.json
```

更多用法参考 `package.json` scripts 或运行 `npm run` 查看全部命令。

---

## 4. Memory 激活状态

| 层级 | 来源 | 触发条件 | 状态 |
|------|------|----------|------|
| **Layer 1** | `canonical/` 目录（agents、skills、runtime-assets） | 修改 canonical 文件后 | 需运行 `meta:sync` |
| **Layer 2** | `.claude/` `.codex/` 等运行时目录 | `meta:sync` 执行后 | 自动生成 |
| **Layer 3** | run-index、local profile state | `meta:index:runs` 索引后 | 可查询 |

> Layer 2 的内容由 `meta:sync` 生成，不应手动编辑（会被覆盖）。
> Layer 3 需要显式调用 `meta:index:runs` 建立索引。

---

## 5. 常见问题 + 快速修复

### Q1: `meta:sync` 报错 "hooks out of sync"

```bash
npm run meta:doctor:governance
```
检查 contract 和 hook 命令是否匹配。确认 `.claude/settings.json` 的 hooks 与 `scripts/validate-project.mjs` 一致。

### Q2: Node 版本不支持

```bash
node --version   # 需要 >= 22.13.0
```
如版本过低，升级 Node.js 后重试。

### Q3: `meta:validate:run` 报告 "ok: false"

检查 artifact 文件路径是否正确，使用 repo 相对路径：

```bash
npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-run.json
```

### Q4: `meta:doctor` 未找到脚本

确认当前在项目根目录，且 `node setup.mjs` 已成功执行。

### Q5: run-index 查询为空

先运行索引：

```bash
npm run meta:index:runs -- <artifact-dir-or-file>
```

---

## 6. 完整文档

- [README.md](../README.md) — 项目概览、架构说明
- [docs/runtime-capability-matrix.md](./runtime-capability-matrix.md) — 各平台能力对照
- [docs/repo-map.md](./repo-map.md) — 目录结构详解
- [docs/research/README.md](./research/README.md) — 平台与依赖研究

---

## 附录：高频命令速查

```bash
npm run meta:setup:install    # 安装依赖和 hooks
npm run meta:sync             # 同步 canonical -> 运行时
npm run meta:validate         # 验证项目完整性
npm run meta:doctor:governance # governance 自检
npm run meta:check            # sync 检查 + validate
npm run meta:verify:all       # 全量验证（check + eval + test）
```
