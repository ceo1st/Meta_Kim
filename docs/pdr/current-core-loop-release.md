# Core Loop Architecture Repair PDR

Status: Done
Owner: meta-warden
Release target: 2.8.22
Last updated: 2026-06-12

## Current Version Goal

Make Meta_Kim's default governed execution path runnable, verifiable, and evolvable for ordinary durable natural-language work.

Default spine:

```text
Critical -> Fetch -> Thinking -> Execution -> Review -> Meta-Review -> Verification -> Evolution
```

This release must prove that the default entry can produce a run artifact, that Fetch sees more than skills, that capability gaps are explicit, that work is dispatched through bounded worker tasks, that Review and Meta-Review check upstream quality, that Verification is a completion fuse rather than a per-step brake, and that Evolution writes back or records none-with-reason.

## Non-Goals

- Do not rewrite the whole project.
- Do not delete scripts by count or name alone.
- Do not treat any one runtime as the only truth source.
- Do not hand-edit generated runtime mirrors as durable source.
- Do not make Verification a heavy stop after every ordinary step.
- Do not claim live runtime or public-ready evidence from structural smoke alone.
- Do not turn dependency projects into hard core dependencies unless the registry and validators prove that role.

## Acceptance Checklist

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| A1 | Core loop contract defines stage input/output/skip/gate/block/warn/public-ready/evolution policy. | `config/contracts/core-loop-contract.json`; `npm run meta:governance:validate` | Done |
| A2 | Default governed entry produces a complete core loop run artifact. | `npm run meta:theory:run -- --task "<durable task>"`; generated artifact under `.meta-kim/state/default/governed-executions/` | Done |
| A3 | A strict workflow-contract fixture validates with `meta:validate:run`. | `npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-core-loop-release-run.json` | Done |
| A4 | Fetch capability inventory is not skill-only and includes agents, skills, scripts/tools, MCP, hooks/config/runtime, OS, graph, memory, and external dependency candidates. | `npm run meta:capabilities:index`; `.meta-kim/state/default/capability-inventory.json`; governance tests | Done |
| A5 | Missing capability emits `capabilityGapPacket`; ready capability emits owner, weapon, review owner, meta-review owner, and verification owner. | `meta:theory:run` artifact and tests | Done |
| A6 | Dynamic workflow records Clarify, Shrink scope, Options, Execute, Verify, Fix, Rollback, Risk, Nudge, and Pause with trigger/reason/cost/skip/risk/escalation fields. | `coreLoop.dynamicWorkflowDecisionRecord`; governance tests | Done |
| A7 | Execution uses worker task packets and does not claim the main thread handled all work as an all-purpose executor. | `workerTaskPackets`, `executionResult`, `executionOwnership` tests | Done |
| A8 | Review checks Critical, Fetch, and Thinking quality before result polish; Meta-Review checks Review standard and overclaim risk. | `reviewPacket`, `metaReviewPacket`, governance tests | Done |
| A9 | Verification blocks public-ready/release-grade claims without evidence, but ordinary low-risk work can use smoke evidence. | `verificationPolicy`, invalid public-ready fixture tests | Done |
| A10 | Evolution records writeback or none-with-reason, and reusable gaps target canonical/config capability indexes. | `evolutionWritebackDecision`, `evolutionWritebackPacket` | Done |
| A11 | Runtime projection boundaries stay format-specific across Claude Code, Codex, Cursor, and OpenClaw. | `npm run meta:check:runtimes`; runtime matrix tests | Done |
| A12 | Script governance registry classifies scripts and marks cleanup candidates without deleting by count. | `scripts/README.md`; script governance tests | Done |
| A13 | Release evidence is current and local verification commands are recorded honestly. | Release Evidence section below | Done |

## Required Files And Modules

| Area | Files |
|---|---|
| Core contract | `config/contracts/core-loop-contract.json`, `config/contracts/workflow-contract.json` |
| Default orchestrator | `scripts/run-meta-theory-governed-execution.mjs`, `package.json` script `meta:theory:run` |
| Capability discovery bus | `scripts/build-capability-inventory.mjs`, `config/capability-index/*.json`, `.meta-kim/state/default/capability-inventory.json` |
| Validators | `scripts/validate-governance-contracts.mjs`, `scripts/validate-project.mjs`, `scripts/validate-run-artifact.mjs` |
| Tests and fixtures | `tests/governance/*.test.mjs`, `tests/meta-theory/*.test.mjs`, `tests/fixtures/run-artifacts/*.json` |
| Docs and release | `README.md`, `AGENTS.md`, `canonical/skills/meta-theory/SKILL.md`, `scripts/README.md`, `CHANGELOG.md`, `CHANGELOG.zh-CN.md`, this PDR |

## Test Commands

| Command | Purpose | Status |
|---|---|---|
| `npm run meta:sync` | Sync canonical sources to runtime projections. | PASS |
| `npm run discover:global` | Refresh global capability inventory. | PASS |
| `npm run meta:check` | Runtime sync, sync coverage, project validation. | PASS |
| `npm run meta:validate` | Project and contract validation. | PASS |
| `npm run meta:release:smoke` | Default low-risk release smoke path. | PASS |
| `npm run meta:verify:governance` | Governance validators and tests. | PASS |
| `graphify update . --force` + `npm run meta:graphify:check` | Rebuild and check Graphify after code and contract edits. | PASS |
| `npm run meta:check:global:release` | Verify installed global skill and hook projections. | PASS |
| `npm run meta:verify:all` | Full release-grade local verification. | PASS |
| `npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-core-loop-release-run.json` | Strict workflow run artifact validation. | PASS |
| `git diff --check` | Whitespace and patch hygiene. | PASS |

## Release Checklist

- [x] PDR created and updated from In Progress to Done / Partial / Blocked.
- [x] Core loop implementation and tests pass.
- [x] Strict run artifact fixture validates.
- [x] Changelogs updated in English and Chinese.
- [x] Version bumped according to impact.
- [x] `git status --short` reviewed before commit.
- [x] Commit created with release message.
- [x] Tag created.
- [x] Branch and tag pushed.
- [x] GitHub Release created, or release notes generated with exact blocker.

## Risk Register

| Risk | Handling |
|---|---|
| Existing `meta:theory:run` artifact is structural but not strict workflow-contract compliant. | Mitigated by top-level core-loop packets plus a dedicated strict fixture validated by `meta:validate:run`; the default artifact still does not claim live worker execution. |
| Full `meta:verify:all` may fail due local runtime, global hook, graph, auth, or environment drift. | First attempt failed at global skill folder sync; fixed via `node scripts/sync-global-meta-theory.mjs --with-global-hooks`, then `meta:check:global:release` and full `meta:verify:all` passed. |
| Generated runtime mirrors may change during sync. | Edit canonical/config first, run sync, review generated diff instead of hand-editing mirrors. |
| Script cleanup can break hidden manual workflows. | Do not delete; classify and keep candidates through at least one release cycle. |
| Live worker execution could be overclaimed. | Artifact must state whether worker execution was structural, simulated, or live. Public-ready requires current verification evidence. |

## Release Evidence

| Command | Result | Notes |
|---|---|---|
| `git status --short` | PASS | Baseline captured before PDR: existing core-loop repair edits plus new untracked contract/tests. |
| `git diff --stat` | PASS | Baseline captured before PDR and rerun after implementation. |
| `node_modules` dependency check | PASS | `node_modules` present; no dependency install was required. |
| `npm run meta:sync` | PASS | Project runtime projections are in sync. |
| `npm run discover:global` | PASS | Global capability inventory refreshed and mirrored to runtime capability indexes. |
| `npm run meta:check` | PASS | Runtime sync check, sync coverage, and project validation passed. |
| `npm run meta:validate` | PASS | Project validation passed. |
| `npm run meta:release:smoke` | PASS | Sync, capability smoke, and 1010 meta-theory tests passed. |
| `npm run meta:verify:governance` | PASS | Governance contracts, runtime/OS/deps/provider/route/intent/prompt/foundational/hook validators, and 47 governance tests passed. |
| `npm run meta:graphify:rebuild` | FAIL | After a late test edit, wrapper rebuild refused to overwrite because the new graph had 7 fewer nodes than the existing graph and requested `--force`. |
| `graphify update . --force` | PASS | Forced Graphify rebuild completed and wrote `graphify-out/graph.json` and `GRAPH_REPORT.md`. |
| `npm run meta:graphify:check` | PASS | Graphify graph matched current HEAD after the forced rebuild. |
| `npm run meta:check:global:release` | FAIL then PASS | First failed because Claude/Codex global directory skills were absent; project sync repaired them and the rerun passed. |
| `npm run meta:verify:all` | FAIL then PASS | First failed at global release check; final rerun passed full release-grade local verification. |
| `npm run meta:validate:run -- tests/fixtures/run-artifacts/valid-core-loop-release-run.json` | PASS | Strict workflow fixture validated. |
| `npm run meta:theory:run -- --task "Meta_Kim core-loop architecture repair v2.8.22 final release evidence" --run-id core-loop-release-v2.8.22-final` | PASS | Default governed entry produced `.meta-kim/state/default/governed-executions/core-loop-release-v2.8.22-final.json` and a Chinese report. |
| `git diff --check` | PASS | No whitespace errors. |
| `git push origin main` | PASS | Branch pushed with release evidence closure. |
| `git push origin v2.8.22` | PASS | Release tag pushed. |
| `gh release create v2.8.22` | PASS | GitHub Release created. |

## Completion Decision

Status: Done

Core-loop repair is complete for the 2.8.22 release scope: the default governed execution layer is structurally runnable, capability discovery is multi-type and wired into the default artifact, strict workflow fixture validation exists, PDR/test evidence is mapped, and release-grade local verification passed. This release does not claim live worker/runtime public-ready evidence beyond the verified local release gates.
