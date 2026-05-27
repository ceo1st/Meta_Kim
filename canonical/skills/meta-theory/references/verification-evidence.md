# Verification Evidence

Never accept "I tested it" without evidence.

Every verified claim must answer:

- who tested it
- what was tested
- exact command/check or manual inspection method
- output/log/screenshot/artifact location
- failure disposition

## Worker Evidence

`workerTaskPackets[].verifySteps[].id` is the source of truth. `workerResultPackets[].workerExecutionEvidence[].verifyStepRef` must match one verify step.

`status=skipped` is only a blocked/accepted-risk signal. It cannot support `verificationPacket.verified=true` or `summaryPacket.publicReady=true`.

`successMarkerFormat`:

- `stdout-text`: non-empty output required.
- `exit-code-only`: exit code 0 and `commandRanAt` required.
- `json-output`: `actualOutput` must parse as JSON.

## Fix Evidence

`verificationPacket.fixEvidence[]` is structured:

- `findingId`
- `actionId`
- `verifiedBy`
- `verificationMethod`
- `evidenceRefs`
- `resultArtifactRef`
- `result`
- `failureDisposition`
- `riskOwner`, `riskReason`, `expiryOrRevisitTrigger` when `result` or close state is `accepted_risk`

Closed findings require matching fix evidence.
