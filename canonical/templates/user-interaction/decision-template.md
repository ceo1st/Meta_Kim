# Decision Template (4-Dimension Options)

Use this template when multiple viable solutions exist with distinct trade-offs.

## Format

| Dimension | Description | Required |
|-----------|-------------|----------|
| **What changes** | Specific scope of modification | ✅ |
| **What problem it solves** | Corresponding requirement or pain point | ✅ |
| **Advantages** | Why choose this approach | ✅ |
| **Disadvantages** | Costs or risks | ✅ |

## AskUserQuestion Schema

```json
{
  "questions": [{
    "question": "{Brief question describing the decision needed}",
    "header": "{Short tag (max 12 chars)}",
    "options": [
      {
        "label": "{Option A}",
        "description": "{What changes}: {description}. {Problem solved}: {description}. {Advantages}: {description}. {Disadvantages}: {description}"
      },
      {
        "label": "{Option B}",
        "description": "{Same 4-dimension format}"
      }
    ],
    "multiSelect": false
  }]
}
```

## Example

```json
{
  "questions": [{
    "question": "How should AskUserQuestion confirmations be adjusted?",
    "header": "Confirm Mode",
    "options": [
      {
        "label": "Keep current 4-point confirmation",
        "description": "What changes: None. Problem solved: Ensures full user control. Advantages: Safe, no missed confirmations. Disadvantages: 4 interruptions, poor UX."
      },
      {
        "label": "Confirm only at key decision points",
        "description": "What changes: Modify confirmation trigger rules in SKILL.md. Problem solved: Reduces unnecessary interruptions. Advantages: Better UX, only decide at key nodes. Disadvantages: May miss edge case confirmations."
      },
      {
        "label": "Batch collect all questions",
        "description": "What changes: Add batch collection mechanism to SKILL.md. Problem solved: Handle multiple decisions in one interaction. Advantages: Efficient, focused attention. Disadvantages: Higher implementation complexity."
      }
    ],
    "multiSelect": false
  }]
}
```

## When to Use

- ≥2 viable solutions exist with clear trade-offs
- Product/Business direction must be clarified
- Security or rollback risk requires explicit acknowledgment
