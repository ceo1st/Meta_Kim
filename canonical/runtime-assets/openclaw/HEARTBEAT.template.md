<!-- Canonical template synced to openclaw/workspaces/<agent>/HEARTBEAT.md by scripts/sync-runtimes.mjs::buildHeartbeat(). DO NOT EDIT GENERATED FILES; edit this template instead. -->
# HEARTBEAT.md - {{AGENT_ID}}

## Capability-First Mandatory Refusal (OpenClaw)

OpenClaw has internal command/lifecycle hooks and typed plugin hooks, but this Meta_Kim projection has not installed a typed plugin adapter for tool-call denial. The four-runtime governance contract (Claude / Codex / Cursor / OpenClaw) requires `fetchRecord.capabilitySearchPerformed = true` before any Agent dispatch in regulated runs. Claude Code, Codex, and Cursor can enforce the dispatch gate mechanically through tool hooks. OpenClaw enforces the same rule here through workspace instructions until a typed plugin policy hook is installed.

**Before dispatching any execution worker or running any execution-layer task in OpenClaw, you must:**

1. Search `config/capability-index/meta-kim-capabilities.json` for matching capability owners.
2. Search `canonical/agents/*.md` for boundary fit.
3. Search OpenClaw execution surfaces: `openclaw/workspaces/`, `openclaw/skills/`, `openclaw/hooks/`, `openclaw/openclaw.template.json`, MCP config, package scripts, and dependency-project registry.
4. Record the search outcome in the run's `fetchRecord` field.
5. Only then dispatch.

If you cannot record the search outcome, **refuse** to execute and respond:

> "OpenClaw capability-first refusal: I cannot dispatch without fetchRecord evidence. Please run capability discovery first or escalate to meta-warden."

This is not a soft preference. This is the OpenClaw-equivalent of the mechanical tool-call deny that Claude / Codex / Cursor enforce. Treat it as a hard contract.

## Meta-Theory And Project-Understanding Entry

OpenClaw does not use the same slash-command file surface as Claude Code or Codex. The OpenClaw equivalent is this workspace contract plus the shared skill at `openclaw/skills/meta-theory/SKILL.md`.

When the user asks for `meta-theory`, `/meta-theory`, `元理论`, `critical and fetch thinking and review`, project/repo/codebase understanding, architecture analysis, hook/MCP/tool routing, commercialization, market, competitor, pricing, customer, investor, growth, strategy, or roadmap work, **do not answer from a quick summary**.

Run or faithfully follow the governed entry:

```sh
npm run meta:theory:run -- "<user request>"
```

If command execution is unavailable in the OpenClaw host, stop before shallow analysis and report `blocked_to_fetch` with the exact missing capability.

For project-understanding tasks, Fetch must inspect or explicitly account for `README.md`, `AGENTS.md`, `package.json`, `canonical/agents/`, `canonical/skills/`, `canonical/runtime-assets/`, `config/contracts/`, `config/capability-index/`, runtime projections, MCP configs, hooks, dependency-project registry, and Graphify (`graphify-out/GRAPH_REPORT.md` or `graphify-out/wiki/index.md`) when present.

For current market, competitor, pricing, provider, version, platform, or external-world claims, Fetch must prove an available retrieval path such as web search, URL fetch, browser, MCP provider, docs lookup, or a recorded local-only justification. If no retrieval path exists, return `blocked_to_fetch` instead of guessing.

Official OpenClaw workspace note: the workspace is the default cwd and context home, not a hard sandbox. Absolute paths can still reach host files unless sandboxing is configured. Do not treat workspace placement as a security boundary.

Cross-reference: see `AGENTS.md` for the cross-runtime enforcement matrix and `canonical/runtime-assets/claude/hooks/enforce-agent-dispatch.mjs` for the mechanical sibling.

## Default Heartbeat Policy

- If there is no explicit scheduled work, respond with `HEARTBEAT_OK`.
- Do not create autonomous tasks or self-assign missions by default.
- Only act proactively after the deployment owner adds concrete heartbeat tasks below.

## Deployment Tasks

- None by default.
