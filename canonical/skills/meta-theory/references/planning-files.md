# Planning Files (8-Stage Coverage)

When file-based planning is enabled and the task is not a pure query, planning files track the full spine:

- `task_plan.md`: goal, phases, dependencies, status checkpoints
- `findings.md`: evidence, decisions, contradictions, open issues
- `progress.md`: stage-by-stage progress, completed checks, current state

Each stage has specific update responsibility:

| Stage | Updates | Content |
|-------|---------|---------|
| Critical | `task_plan.md` | Initialize: goal, context, phases, dependencies |
| Fetch | `findings.md` | Evidence collected, decision impact map, contradictions |
| Thinking | `task_plan.md`, `findings.md` | Solution paths, chosen rationale, capability gaps |
| Execution | `progress.md` | Worker progress, file completion list, execution evidence |
| Review | `findings.md`, `progress.md` | Quality findings, boundary checks, review decisions |
| Meta-Review | `findings.md` | Review standard evaluation, review quality assessment |
| Verification | `progress.md` | Verification results, evidence binding, closure status |
| Evolution | `task_plan.md`, `progress.md` | Final status, writeback decision, lessons learned |

These files are supplemental. Packets in `config/contracts/workflow-contract.json` remain canonical.

Only the conductor/main coordinator writes these planning files unless the run explicitly delegates ownership.
