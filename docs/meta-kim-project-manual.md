# Meta_Kim Project Manual

Meta_Kim is a governance layer for durable AI coding work. It does not replace Claude Code, Codex, OpenClaw, Cursor, or other coding runtimes. It gives those runtimes a shared execution contract: clarify the real task, find the right capability, choose an owner, execute within boundaries, review the result, verify reality, and preserve useful lessons.

This manual explains Meta_Kim as a product and a maintainable project. For command-level setup, start with `README.md`.

## 1. What Problem It Solves

Modern AI coding tools can change files quickly. The hard part is not motion; it is control.

Common failure modes include:

- a vague request turns into a large unreviewed patch
- the tool starts editing before it understands the real outcome
- command success is treated as user-goal success
- review, verification, and follow-up ownership are mixed together
- good lessons stay trapped in chat history
- each runtime grows a different local prompt system

Meta_Kim exists to make complex AI work governable. It turns "the model did something" into "the system can explain what it tried to achieve, why this route was selected, who owned each part, what evidence passed, what remains uncertain, and what should be reused next time."

## 2. Core Idea

Meta_Kim uses one canonical governance layer and projects it into multiple runtimes.

The durable source lives in:

- `canonical/agents/`
- `canonical/skills/meta-theory/`
- `canonical/runtime-assets/`
- `config/contracts/`
- `config/capability-index/`

Runtime folders such as `.claude/`, `.codex/`, `.agents/`, `.cursor/`, and `openclaw/` are projections. They are generated local outputs, not the long-term source of behavior.

The product principle is simple:

> One governance system, many runtime projections.

## 3. The Eight-Stage Spine

Meta_Kim's execution spine is:

```text
Critical -> Fetch -> Thinking -> Execution -> Review -> Meta-Review -> Verification -> Evolution
```

Each stage has a job:

- Critical: lock the real intent, success criteria, non-goals, and blocking unknowns
- Fetch: gather evidence that changes routing, risk, scope, or acceptance
- Thinking: choose the route, owners, capabilities, lanes, and verification plan
- Execution: perform bounded work through the selected owner or tool
- Review: inspect the output against the original goal and quality bar
- Meta-Review: check whether the review itself was strong enough when risk is high
- Verification: prove reality with tests, checks, runtime evidence, or user-visible state
- Evolution: write back reusable lessons, or record why no writeback is needed

The stages are not ceremony. They prevent the system from skipping straight from a fuzzy instruction to uncontrolled file changes.

## 4. Capability-First Routing

Meta_Kim does not start by asking "which agent should I call?" It starts with "what capability is needed?"

The intended route is:

```text
Need capability
-> search canonical capability index
-> search runtime mirror indexes
-> search local runtime inventory
-> search available skills and tools
-> choose the best owner by boundary fit
-> execute with explicit scope, deliverable, review owner, and verification owner
```

This matters because an agent name is not a capability proof. Runtime files, plugin surfaces, MCP providers, hooks, commands, and skills all have different evidence levels.

## 5. Install Scope

The default install path creates global reusable capabilities.

Running:

```bash
node setup.mjs
```

installs selected runtime assets into the runtime home directories where the runtime supports global assets. For example, Claude Code global hooks go under the Claude home hook package instead of being written into every project.

Project-local files are created only when project bootstrap or project-specific customization is selected:

```bash
node setup.mjs --project-bootstrap --apply
```

The project path must preserve user assets. Meta_Kim uses managed blocks, JSON merge, backups, manifests, and add-only behavior where possible. Unknown user files are not disposable just because a generated projection exists nearby.

## 6. Runtime Projections

Meta_Kim currently treats Claude Code and Codex as the primary formal projections, with OpenClaw and Cursor maintained as additional formal projections that require runtime-specific evidence.

Typical projection roles:

- Claude Code: agents, skills, commands, hooks, settings, MCP
- Codex: project context, skills, commands, hooks, config, custom-agent adapters where supported
- Cursor: rules, agents, skills, hooks, MCP, capability index
- OpenClaw: workspaces, skills, template config, capability index

The source repository intentionally keeps project projection folders out of Git. A clean source checkout can have no `.claude/`, `.codex/`, `.agents/`, `.cursor/`, `openclaw/`, `.mcp.json`, or `codex/` projection files. That is expected. Those files are materialized by setup or sync when a runtime/project target needs them.

## 7. Evidence Levels

Meta_Kim keeps evidence layers separate.

Useful but different evidence includes:

- source file inspection
- validator pass
- local smoke test
- install/update simulation
- real runtime invocation
- user-visible runtime behavior
- public remote state

A validator pass does not prove a live runtime pass. A config file does not prove that the runtime invoked it. A local smoke test does not prove that a user can see the result.

This separation is one of Meta_Kim's main safety features.

## 8. Governance Agents

Meta_Kim uses nine meta agents as governance units:

- `meta-warden`: coordination, arbitration, final synthesis
- `meta-conductor`: workflow sequencing and business-flow planning
- `meta-genesis`: identity and prompt architecture
- `meta-artisan`: skill, MCP, and tool fit
- `meta-sentinel`: safety, permissions, hooks, rollback
- `meta-librarian`: memory and continuity
- `meta-prism`: review quality and drift detection
- `meta-scout`: external capability discovery
- `meta-chrysalis`: evolution signal aggregation and writeback coordination

These agents govern the work. They are not meant to become generic implementation workers when a more suitable execution role exists.

## 9. Maintainer Workflow

For durable changes, edit canonical sources first, then sync projections:

```bash
npm run meta:sync
npm run meta:check
```

For routine prompt, doc, or governance wording changes, use the release smoke path:

```bash
npm run meta:release:smoke
git diff --check
```

For install/update, hook, runtime, dependency, provider, or release-grade changes, use stronger verification:

```bash
npm run meta:verify:all
```

The point is not to run the largest command every time. The point is to match the evidence to the risk.

## 10. User Experience Goal

The ideal user experience is not "learn Meta_Kim's internal protocol."

The ideal flow is:

1. The user states a normal task in natural language.
2. Meta_Kim classifies whether it is a query, durable work, subjective/taste-dependent work, or regulated work.
3. If needed, it asks only questions that change execution.
4. It explains the selected route, capability, owner, and success standard.
5. It executes, reviews, and verifies.
6. It says clearly whether the work is complete, partial, blocked, or deferred.
7. If a reusable lesson exists, it records or proposes the writeback path.

## 11. Current Boundaries

Meta_Kim should be described honestly.

Current boundaries:

- it is more useful for complex work than for every tiny edit
- it cannot replace user authorization for external writes, credentials, payments, or high-risk actions
- it does not treat "configured" as "actually invoked"
- it does not treat smoke checks as release-grade live evidence
- Cursor, OpenClaw, and candidate runtimes need evidence-tiered claims
- live pass must come from the actual target runtime, not only from structural validation
- examples, demos, and cross-runtime evidence should continue to grow

## 12. Short Public Description

Meta_Kim turns chaotic AI coding into governed execution.

It helps complex AI work move through intent, capability discovery, ownership, execution, review, verification, and learning. It lets Claude Code, Codex, OpenClaw, Cursor, and future compatible runtimes share one maintainable governance source instead of drifting into separate prompt islands.
