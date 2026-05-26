import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  canonicalAgentsDir,
  canonicalCapabilityIndexDir,
  canonicalRuntimeAssetsDir,
  canonicalSkillsDir,
  canonicalSkillPath,
  canonicalSkillReferencesDir,
  loadRuntimeProfiles,
  loadSyncManifest,
} from "./meta-kim-sync-config.mjs";
import { t } from "./meta-kim-i18n.mjs";
import { validateSkillFrontmatter } from "./install-skill-sanitizer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const canonicalClaudeMcpPath = path.join(
  canonicalRuntimeAssetsDir,
  "claude",
  "mcp.json",
);

/** Must match config/contracts/workflow-contract.json runDiscipline.publicDisplayRequires (set equality). */
const EXPECTED_PUBLIC_DISPLAY_REQUIRES = [
  "verifyPassed",
  "summaryClosed",
  "singleDeliverableMaintained",
  "deliverableChainClosed",
  "consolidatedDeliverablePresent",
];

const CANONICAL_CAPABILITY_INDEX_RELATIVE =
  "config/capability-index/meta-kim-capabilities.json";
const LOCAL_GLOBAL_CAPABILITY_INVENTORY_PATTERN =
  ".meta-kim/state/{profile}/capability-index/global-capabilities.json";

const forbiddenRuntimeMarkers = [
  "AskUserQuestion",
  'Agent(subagent_type="',
  "Skill(skill=",
  "meta-factory.mjs",
  "evolution-analyzer.mjs",
  "keyword-optimizer.mjs",
  "run_loop.py",
];

const EXPECTED_AGENT_WEAPON_MARKERS = {
  "meta-warden": [
    "## Required Deliverables",
    "Participation Summary",
    "Gate Decisions",
    "Escalation Decisions",
    "Final Synthesis",
    "Governed run artifact",
  ],
  "meta-conductor": [
    "## Required Deliverables",
    "Dispatch Board",
    "Card Deck",
    "Worker Task Board",
    "Handoff Plan",
    "Governed run artifact pointer",
  ],
  "meta-genesis": [
    "## Required Deliverables",
    "SOUL.md Draft",
    "Boundary Definition",
    "Reasoning Rules",
    "Stress-Test Record",
  ],
  "meta-artisan": [
    "## Required Deliverables",
    "Skill Loadout",
    "MCP / Tool Loadout",
    "Fallback Plan",
    "Capability Gap List",
    "Adoption Notes",
  ],
  "meta-sentinel": [
    "## Required Deliverables",
    "Threat Model",
    "Permission Matrix",
    "Hook Configuration",
    "Rollback Rules",
  ],
  "meta-librarian": [
    "## Required Deliverables",
    "Memory Architecture",
    "Continuity Protocol",
    "Retention Policy",
    "Recovery Evidence",
  ],
  "meta-prism": [
    "## Required Deliverables",
    "Assertion Report",
    "Verification Closure Packet",
    "Drift Findings",
    "Closure Conditions",
  ],
  "meta-scout": [
    "## Required Deliverables",
    "Capability Baseline",
    "Candidate Comparison",
    "Security Notes",
    "Adoption Brief",
  ],
};

function assert(condition, message) {
  if (!condition) {
    // Human-friendly: strip dev-path jargon from messages
    const clean = message
      .replace(/\.claude\/agents\//g, "Claude agent ")
      .replace(/\.claude\/skills\//g, "Claude skill ")
      .replace(/\.codex\/agents\//g, "Codex agent ")
      .replace(/\.codex\/skills\//g, "Codex skill ")
      .replace(/\.agents\/skills\//g, "Codex项目skill ")
      .replace(/openclaw\/workspaces\//g, "OpenClaw workspace ")
      .replace(/openclaw\/skills\//g, "OpenClaw skill ")
      .replace(/\.md /g, ".md ")
      .replace(/\.toml /g, ".toml ");
    throw new Error(clean);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(rootDir, extension) {
  let count = 0;
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(entryPath, extension);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      count += 1;
    }
  }
  return count;
}

async function walkFiles(rootDir, extension, bucket = []) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(entryPath, extension, bucket);
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      bucket.push(entryPath);
    }
  }
  return bucket;
}

async function walkFilesByExtensions(rootDir, extensions, bucket = []) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "graphify-out" ||
        entry.name === ".meta-kim" ||
        entry.name === ".backup" ||
        entry.name === ".claude" ||
        entry.name === ".codex" ||
        entry.name === ".cursor" ||
        entry.name === ".agents" ||
        entry.name === "openclaw" ||
        entry.name === "memory"
      ) {
        continue;
      }
      await walkFilesByExtensions(entryPath, extensions, bucket);
    } else if (
      entry.isFile() &&
      extensions.some((extension) => entry.name.endsWith(extension))
    ) {
      bucket.push(entryPath);
    }
  }
  return bucket;
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function getNpmScriptReferences(raw) {
  const references = new Set();
  const regex = /\bnpm\s+run\s+(?!run\b)([A-Za-z0-9:_-]+)/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    references.add(match[1]);
  }
  return [...references].sort();
}

function labelForNodeId(nodesById, id) {
  return nodesById.get(id)?.label ?? "";
}

async function listCanonicalSkillReferences() {
  const entries = await fs.readdir(canonicalSkillReferencesDir, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

async function listCanonicalSkillManifests() {
  const entries = await fs.readdir(canonicalSkillsDir, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillPath = path.join(canonicalSkillsDir, entry.name, "SKILL.md");
    if (await exists(skillPath)) {
      manifests.push({
        id: entry.name,
        path: toRepoRelative(skillPath),
      });
    }
  }
  return manifests.sort((left, right) => left.id.localeCompare(right.id));
}

function assertNoForbiddenMarkers(
  raw,
  filePath,
  markers = forbiddenRuntimeMarkers,
) {
  for (const marker of markers) {
    assert(
      !raw.includes(marker),
      `${filePath} still contains forbidden marker: ${marker}`,
    );
  }
}

/**
 * Skill files may contain `Skill(skill=` in the Dependency Resources section —
 * those are documented invocation examples, not forbidden runtime tool calls.
 * This function strips the Dependency Resources section before checking.
 */
function assertNoForbiddenMarkersInSkill(
  raw,
  filePath,
  markers = forbiddenRuntimeMarkers,
) {
  // Extract everything before ## Dependency Resources (case-insensitive)
  const depResMatch = raw.match(/\n## Dependency Resources\b/i);
  const contentBeforeDepRes = depResMatch
    ? raw.substring(0, depResMatch.index)
    : raw;

  // Also extract Dependency Skills section (new name in v1.4.0)
  const depSkillsMatch = raw.match(/\n## Dependency Skills\b/i);
  const contentBeforeDepSkills = depSkillsMatch
    ? raw.substring(0, depSkillsMatch.index)
    : contentBeforeDepRes;

  for (const marker of markers) {
    // Check body before the Dependency Resources/Skills section
    assert(
      !contentBeforeDepSkills.includes(marker),
      `${filePath} still contains forbidden marker: ${marker} (outside Dependency Resources section)`,
    );
  }
}

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath} is missing YAML frontmatter.`);
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(`${filePath} has an invalid frontmatter line: ${line}`);
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    data[key] = value.replace(/^['"]|['"]$/g, "");
  }

  return data;
}

async function validateRequiredFiles() {
  const requiredFiles = [
    "README.md",
    "README.zh-CN.md",
    "CLAUDE.md",
    "AGENTS.md",
    "LICENSE",
    ".gitignore",
    "config/sync.json",
    "canonical/agents/meta-warden.md",
    "canonical/skills/meta-theory/SKILL.md",
    "canonical/runtime-assets/claude/settings.json",
    "canonical/runtime-assets/claude/mcp.json",
    "canonical/runtime-assets/codex/config.toml.example",
    "canonical/runtime-assets/openclaw/openclaw.template.json",
    "config/contracts/sync-manifest.schema.json",
    "config/contracts/runtime-profile.schema.json",
    "config/contracts/workflow-contract.json",
    CANONICAL_CAPABILITY_INDEX_RELATIVE,
    "scripts/mcp/meta-runtime-server.mjs",
  ];

  for (const relativePath of requiredFiles) {
    assert(
      await exists(path.join(repoRoot, relativePath)),
      `Missing required file: ${relativePath}`,
    );
  }
}

async function validateWorkflowContract() {
  const contractPath = path.join(
    repoRoot,
    "config",
    "contracts",
    "workflow-contract.json",
  );
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));

  assert(
    (contract.schemaVersion ?? 0) >= 6,
    "workflow-contract.json schemaVersion must be >= 6 after Critical/Fetch/Thinking/Review packet hardening.",
  );
  assert(
    contract.runDiscipline?.singleDepartmentPerRun === true,
    "workflow-contract.json must enforce singleDepartmentPerRun.",
  );
  assert(
    contract.runDiscipline?.singlePrimaryDeliverable === true,
    "workflow-contract.json must enforce singlePrimaryDeliverable.",
  );
  assert(
    contract.runDiscipline?.rejectMultiTopicRuns === true,
    "workflow-contract.json must reject multi-topic runs.",
  );
  assert(
    contract.runDiscipline?.requireClosedDeliverableChain === true,
    "workflow-contract.json must require a closed deliverable chain.",
  );

  const requiredRunHeader = [
    "department",
    "primaryDeliverable",
    "audience",
    "freshnessRequirement",
    "visualPolicy",
    "handoffPlan",
  ];
  assert(
    JSON.stringify(contract.runDiscipline?.requiredRunHeader ?? []) ===
      JSON.stringify(requiredRunHeader),
    "workflow-contract.json requiredRunHeader is out of policy.",
  );

  for (const field of [
    "todayTask",
    "output",
    "deliverableLink",
    "qualityBar",
    "referenceDirection",
    "handoffTarget",
    "lengthExpectation",
    "visualOrAssetPlan",
  ]) {
    assert(
      contract.runDiscipline?.requiredWorkerFields?.includes(field),
      `workflow-contract.json requiredWorkerFields must include ${field}.`,
    );
  }

  const publicDisplayRequires = contract.runDiscipline?.publicDisplayRequires;
  assert(
    Array.isArray(publicDisplayRequires),
    "workflow-contract.json must define publicDisplayRequires as an array.",
  );
  assert(
    JSON.stringify([...publicDisplayRequires].sort()) ===
      JSON.stringify([...EXPECTED_PUBLIC_DISPLAY_REQUIRES].sort()),
    "workflow-contract.json publicDisplayRequires must exactly match the canonical public-display gate set.",
  );
  assert(
    contract.gates?.dealer?.primaryOwner === "meta-conductor" &&
      contract.gates?.dealer?.escalationOwner === "meta-warden",
    "workflow-contract.json dealer gate must model meta-conductor primary + meta-warden escalation ownership.",
  );
  for (const source of ["meta-sentinel", "meta-prism", "user", "system"]) {
    assert(
      contract.gates?.dealer?.interruptSources?.includes(source),
      `workflow-contract.json dealer gate must include interrupt source ${source}.`,
    );
  }

  assert(
    contract.gates?.publicDisplay?.owner === "meta-warden",
    "workflow-contract.json publicDisplay gate owner must be meta-warden.",
  );
  assert(
    contract.gates?.publicDisplay?.hardReleaseGate === true,
    "workflow-contract.json publicDisplay gate must be a hard release gate.",
  );
  assert(
    JSON.stringify(
      [...(contract.gates?.publicDisplay?.requiredConditions ?? [])].sort(),
    ) === JSON.stringify([...EXPECTED_PUBLIC_DISPLAY_REQUIRES].sort()),
    "workflow-contract.json publicDisplay requiredConditions must match publicDisplayRequires.",
  );
  for (const field of [
    "blockFinalDraftWithoutVerifiedRun",
    "blockExternalDisplayWithoutSummaryClosure",
    "blockCompletionWithoutClosedDeliverableChain",
  ]) {
    assert(
      contract.gates?.publicDisplay?.[field] === true,
      `workflow-contract.json publicDisplay gate must set ${field} to true.`,
    );
  }

  const taskClassification = contract.runDiscipline?.taskClassification;
  assert(
    taskClassification?.classifierVersion === "v2",
    "workflow-contract.json taskClassification classifierVersion must be v2.",
  );
  for (const [field, expected] of [
    ["taskClassEnum", ["Q", "A", "P", "S"]],
    ["requestClassEnum", ["query", "execute", "plan", "strategy"]],
    [
      "governanceFlowEnum",
      [
        "query",
        "simple_exec",
        "complex_dev",
        "meta_analysis",
        "proposal_review",
        "rhythm",
      ],
    ],
    [
      "triggerReasonEnum",
      [
        "multi_file",
        "cross_module",
        "external_side_effect",
        "durable_artifact",
        "owner_missing",
      ],
    ],
    [
      "upgradeReasonEnum",
      [
        "cross_system_scope",
        "review_or_verify_required",
        "owner_creation_required",
      ],
    ],
    [
      "bypassReasonEnum",
      [
        "pure_query",
        "read_only_explanation",
        "existing_verified_artifact_reuse",
      ],
    ],
  ]) {
    for (const item of expected) {
      assert(
        taskClassification?.[field]?.includes(item),
        `workflow-contract.json taskClassification.${field} must include ${item}.`,
      );
    }
  }
  assert(
    taskClassification?.ownerRequiredByDefault === true &&
      taskClassification?.onlyQueryMayBypassOwner === true,
    "workflow-contract.json taskClassification must keep owner-required-by-default discipline.",
  );

  const cardGovernance = contract.runDiscipline?.cardGovernance;
  assert(
    cardGovernance?.enabled === true,
    "workflow-contract.json cardGovernance must be enabled.",
  );
  assert(
    cardGovernance?.dealerRoleModel === "conductor-primary-warden-escalation",
    "workflow-contract.json cardGovernance dealerRoleModel must be conductor-primary-warden-escalation.",
  );
  for (const [field, expected] of [
    [
      "cardTypeEnum",
      ["info", "action", "risk", "silence", "default", "upgrade"],
    ],
    [
      "cardDecisionEnum",
      ["deal", "suppress", "defer", "skip", "interrupt_insert", "escalate"],
    ],
    [
      "cardAudienceEnum",
      ["user", "owner", "reviewer", "governance", "runtime"],
    ],
    [
      "cardTimingEnum",
      [
        "immediate",
        "next_stage",
        "after_dependency",
        "after_verify",
        "on_risk",
        "on_timeout",
        "on_user_request",
      ],
    ],
    [
      "cardShellEnum",
      [
        "conversation",
        "file",
        "packet",
        "agent_dispatch",
        "summary",
        "silent_hold",
      ],
    ],
    [
      "cardSourceEnum",
      [
        "meta-conductor",
        "meta-warden",
        "meta-sentinel",
        "meta-prism",
        "system",
        "user",
      ],
    ],
    [
      "suppressionReasonEnum",
      [
        "attention_budget_low",
        "already_known",
        "already_in_context",
        "verification_pending",
        "public_display_blocked",
        "no_clear_intervention_gain",
      ],
    ],
  ]) {
    for (const item of expected) {
      assert(
        cardGovernance?.[field]?.includes(item),
        `workflow-contract.json cardGovernance.${field} must include ${item}.`,
      );
    }
  }
  assert(
    cardGovernance?.defaultNoCardPolicy ===
      "prefer_silence_without_clear_intervention_gain",
    "workflow-contract.json cardGovernance must define the default no-card policy.",
  );
  for (const item of [
    "native_choice",
    "native_mode_picker",
    "native_hook_prompt",
    "conversation_fallback",
  ]) {
    assert(
      cardGovernance?.choiceSurfaceEnum?.includes(item),
      `workflow-contract.json cardGovernance.choiceSurfaceEnum must include ${item}.`,
    );
  }

  const userLanguagePolicy = contract.runDiscipline?.userLanguagePolicy;
  assert(
    userLanguagePolicy?.hardcodedSingleHumanLanguageForbidden === true,
    "workflow-contract.json userLanguagePolicy must forbid hardcoded single-language user-facing text.",
  );
  assert(
    userLanguagePolicy?.stageLabelsRemainCanonicalEnglish === true,
    "workflow-contract.json userLanguagePolicy must keep protocol stage labels canonical English.",
  );
  assert(
    userLanguagePolicy?.userFacingTextLanguageSource ===
      "runtime_tool_selected_output_language_else_explicit_output_language_choice_else_latest_user_input_language",
    "workflow-contract.json userLanguagePolicy must follow runtime/tool selected output language first, explicit output-language choice second, then latest user input language.",
  );
  assert(
    typeof userLanguagePolicy?.fallbackLocale === "string" &&
      userLanguagePolicy.fallbackLocale.length > 0,
    "workflow-contract.json userLanguagePolicy must define fallbackLocale.",
  );

  const runtimeNativeChoiceSurfaces =
    contract.runDiscipline?.runtimeNativeChoiceSurfaces ?? {};
  for (const runtime of ["claude", "codex", "openclaw", "cursor"]) {
    assert(
      runtimeNativeChoiceSurfaces[runtime],
      `workflow-contract.json runtimeNativeChoiceSurfaces must include ${runtime}.`,
    );
    assert(
      typeof runtimeNativeChoiceSurfaces[runtime]?.primarySurface === "string",
      `workflow-contract.json runtimeNativeChoiceSurfaces.${runtime}.primarySurface must be a string.`,
    );
    assert(
      Array.isArray(runtimeNativeChoiceSurfaces[runtime]?.fallbackSurfaces),
      `workflow-contract.json runtimeNativeChoiceSurfaces.${runtime}.fallbackSurfaces must be an array.`,
    );
    assert(
      typeof runtimeNativeChoiceSurfaces[runtime]?.triggerDescription ===
        "string",
      `workflow-contract.json runtimeNativeChoiceSurfaces.${runtime}.triggerDescription must be a string.`,
    );
  }

  const silencePolicy = contract.runDiscipline?.silencePolicy;
  assert(
    silencePolicy?.noInterventionPreferred === true &&
      silencePolicy?.requiresInterruptionJustification === true &&
      silencePolicy?.deferRequiresDeadline === true,
    "workflow-contract.json silencePolicy must prefer no-intervention and require interruption/defer discipline.",
  );
  for (const item of ["none", "no_card", "defer", "intentional_silence"]) {
    assert(
      silencePolicy?.silenceDecisionEnum?.includes(item),
      `workflow-contract.json silencePolicy.silenceDecisionEnum must include ${item}.`,
    );
  }

  const controlIntervention = contract.runDiscipline?.controlIntervention;
  assert(
    controlIntervention?.requiresReturnToMainChain === true,
    "workflow-contract.json controlIntervention must require return-to-main-chain discipline.",
  );
  for (const [field, expected] of [
    [
      "decisionTypeEnum",
      ["skip", "interrupt", "override", "escalation_insert"],
    ],
    [
      "skipReasonEnum",
      [
        "already_known",
        "already_in_context",
        "attention_budget_low",
        "not_applicable",
        "artifact_not_needed",
      ],
    ],
    [
      "interruptReasonEnum",
      [
        "security_risk",
        "quality_drift",
        "user_urgent",
        "system_failure",
        "global_impact",
      ],
    ],
    [
      "overrideReasonEnum",
      [
        "security_override",
        "verification_block",
        "public_display_block",
        "governance_owner_insert",
      ],
    ],
    [
      "insertedGovernanceOwners",
      ["meta-sentinel", "meta-prism", "meta-warden", "meta-conductor"],
    ],
  ]) {
    for (const item of expected) {
      assert(
        controlIntervention?.[field]?.includes(item),
        `workflow-contract.json controlIntervention.${field} must include ${item}.`,
      );
    }
  }

  const deliveryShell = contract.runDiscipline?.deliveryShell;
  for (const [field, expected] of [
    [
      "shellTypeEnum",
      [
        "one_line",
        "structured_status",
        "technical_detail",
        "review_delta",
        "executive_summary",
        "artifact_link",
      ],
    ],
    ["presentationModeEnum", ["direct", "digest", "deferred", "quiet"]],
    ["exposureLevelEnum", ["internal", "review", "public"]],
    [
      "interventionFormEnum",
      [
        "conversation",
        "file_write",
        "task_packet",
        "agent_dispatch",
        "notification",
        "none",
      ],
    ],
  ]) {
    for (const item of expected) {
      assert(
        deliveryShell?.[field]?.includes(item),
        `workflow-contract.json deliveryShell.${field} must include ${item}.`,
      );
    }
  }

  const requiredPackets =
    contract.runDiscipline?.protocolFirst?.requiredPackets ?? [];
  for (const packet of [
    "runHeader",
    "taskClassification",
    "fetchPacket",
    "cardPlanPacket",
    "dispatchEnvelopePacket",
    "orchestrationTaskBoardPacket",
    "businessFlowBlueprintPacket",
    "productCompletenessPacket",
    "experienceQualityPacket",
    "testStrategyPacket",
    "structureHygienePacket",
    "permissionMatrixPacket",
    "sideEffectLedgerPacket",
    "rollbackPlanPacket",
    "agentBlueprintPacket",
    "dispatchBoard",
    "workerTaskPacket",
    "workerResultPacket",
    "reviewPacket",
    "verificationPacket",
    "summaryPacket",
    "evolutionWritebackPacket",
  ]) {
    assert(
      requiredPackets.includes(packet),
      `workflow-contract.json protocolFirst.requiredPackets must include ${packet}.`,
    );
  }
  for (const flow of [
    "simple_exec",
    "complex_dev",
    "meta_analysis",
    "proposal_review",
    "rhythm",
  ]) {
    assert(
      contract.runDiscipline?.protocolFirst?.orchestrationTaskBoardPacketRequiredWhenGovernanceFlows?.includes(
        flow,
      ),
      `workflow-contract.json orchestrationTaskBoardPacketRequiredWhenGovernanceFlows must include ${flow}.`,
    );
  }
  assert(
    contract.runDiscipline?.protocolFirst?.capabilityGapPacketRequiredWhenUpgradeReasons?.includes(
      "owner_creation_required",
    ),
    "workflow-contract.json capabilityGapPacketRequiredWhenUpgradeReasons must include owner_creation_required.",
  );
  for (const action of ["create_execution_agent", "upgrade_execution_agent"]) {
    assert(
      contract.runDiscipline?.protocolFirst?.executionAgentCardRequiredWhenResolutionActions?.includes(
        action,
      ),
      `workflow-contract.json executionAgentCardRequiredWhenResolutionActions must include ${action}.`,
    );
  }

  const findingClosure = contract.runDiscipline?.findingClosure;
  for (const field of [
    "findingIdRequired",
    "reviewFindingRequiresRevisionResponse",
    "revisionResponseRequiresFixArtifact",
    "verificationRequiresFreshEvidence",
    "closureRequiresVerificationResult",
  ]) {
    assert(
      findingClosure?.[field] === true,
      `workflow-contract.json findingClosure must set ${field} to true.`,
    );
  }
  for (const closeState of [
    "open",
    "fixed_pending_verify",
    "verified_closed",
    "accepted_risk",
  ]) {
    assert(
      findingClosure?.closeStateEnum?.includes(closeState),
      `workflow-contract.json findingClosure.closeStateEnum must include ${closeState}.`,
    );
  }
  for (const transition of [
    "open->fixed_pending_verify",
    "fixed_pending_verify->verified_closed",
    "fixed_pending_verify->accepted_risk",
  ]) {
    assert(
      findingClosure?.legalTransitions?.includes(transition),
      `workflow-contract.json findingClosure.legalTransitions must include ${transition}.`,
    );
  }

  const reviewPacketFields =
    contract.protocols?.reviewPacket?.requiredFields ?? [];
  assert(
    reviewPacketFields.includes("findings"),
    "workflow-contract.json reviewPacket must require findings.",
  );
  assert(
    reviewPacketFields.includes("sourceProjects"),
    "workflow-contract.json reviewPacket must require sourceProjects.",
  );
  assert(
    reviewPacketFields.includes("crossProjectContaminationCheck"),
    "workflow-contract.json reviewPacket must require crossProjectContaminationCheck.",
  );
  assert(
    JSON.stringify(
      contract.protocols?.reviewPacket?.crossProjectContaminationCheckEnum ??
        [],
    ) === JSON.stringify(["pass", "fail"]),
    "workflow-contract.json reviewPacket crossProjectContaminationCheckEnum must be [pass, fail].",
  );

  const integrationPolicy =
    contract.runDiscipline?.integrationContractPolicy ?? {};
  assert(
    integrationPolicy.enabled === true,
    "workflow-contract.json integrationContractPolicy must be enabled.",
  );
  for (const deliverableType of [
    "internal_api_integration",
    "third_party_integration",
  ]) {
    assert(
      integrationPolicy.requiredWhenDeliverableTypes?.includes(deliverableType),
      `workflow-contract.json integrationContractPolicy.requiredWhenDeliverableTypes must include ${deliverableType}.`,
    );
  }
  for (const gate of [
    "source_of_truth",
    "contract_diff",
    "signature_auth",
    "idempotency",
    "callback_webhook",
    "error_model",
    "state_machine",
    "sandbox_contract_test",
    "security_secrets",
    "human_owner_approval",
  ]) {
    assert(
      integrationPolicy.requiredReviewGates?.includes(gate),
      `workflow-contract.json integrationContractPolicy.requiredReviewGates must include ${gate}.`,
    );
  }
  assert(
    integrationPolicy.unknownStatusEnum?.includes("blocking_unknown"),
    "workflow-contract.json integrationContractPolicy.unknownStatusEnum must include blocking_unknown.",
  );
  assert(
    integrationPolicy.blockingUnknownStatuses?.includes("blocking_unknown"),
    "workflow-contract.json integrationContractPolicy.blockingUnknownStatuses must include blocking_unknown.",
  );
  for (const triggerReason of [
    "internal_interface_boundary",
    "third_party_integration",
  ]) {
    assert(
      contract.runDiscipline?.taskClassification?.triggerReasonEnum?.includes(
        triggerReason,
      ),
      `workflow-contract.json taskClassification.triggerReasonEnum must include ${triggerReason}.`,
    );
    assert(
      contract.runDiscipline?.protocolFirst?.interfaceIntegrationContractPacketRequiredWhenTriggerReasons?.includes(
        triggerReason,
      ),
      `workflow-contract.json interfaceIntegrationContractPacketRequiredWhenTriggerReasons must include ${triggerReason}.`,
    );
  }
  const productGatePolicy =
    contract.runDiscipline?.productDeliverableGatePolicy ?? {};
  assert(
    productGatePolicy.enabled === true &&
      productGatePolicy.requiredForNonQuery === true,
    "workflow-contract.json productDeliverableGatePolicy must be enabled for non-query deliverables.",
  );
  for (const packet of [
    "productCompletenessPacket",
    "experienceQualityPacket",
    "testStrategyPacket",
    "structureHygienePacket",
  ]) {
    assert(
      productGatePolicy.requiredPackets?.includes(packet),
      `workflow-contract.json productDeliverableGatePolicy.requiredPackets must include ${packet}.`,
    );
  }
  for (const packet of [
    "permissionMatrixPacket",
    "sideEffectLedgerPacket",
    "rollbackPlanPacket",
  ]) {
    assert(
      productGatePolicy.requiredSideEffectPackets?.includes(packet),
      `workflow-contract.json productDeliverableGatePolicy.requiredSideEffectPackets must include ${packet}.`,
    );
  }
  const dimensionFieldByPacket =
    productGatePolicy.dimensionCoverageFieldByPacket ?? {};
  const expectedDimensionFields = {
    productCompletenessPacket: "designDimensions",
    experienceQualityPacket: "experienceDimensions",
    testStrategyPacket: "testDimensions",
    structureHygienePacket: "structureDimensions",
    permissionMatrixPacket: "permissionDimensions",
    sideEffectLedgerPacket: "sideEffectDimensions",
    rollbackPlanPacket: "rollbackDimensions",
  };
  for (const [packet, field] of Object.entries(expectedDimensionFields)) {
    assert(
      dimensionFieldByPacket[packet] === field,
      `workflow-contract.json productDeliverableGatePolicy.dimensionCoverageFieldByPacket.${packet} must be ${field}.`,
    );
  }
  for (const dimensionId of [
    "core_highlight",
    "feature_completeness",
    "ui_ue_ux",
    "media_audio_motion",
    "api_contract",
    "frontend_backend_contract",
    "third_party_integration",
    "file_management_extensibility",
    "directory_structure",
    "real_test_strategy",
    "evolution_path",
    "dead_redundant_cleanup",
  ]) {
    assert(
      productGatePolicy.designDimensionCatalog?.some(
        (dimension) => dimension.dimensionId === dimensionId,
      ),
      `workflow-contract.json productDeliverableGatePolicy.designDimensionCatalog must include ${dimensionId}.`,
    );
  }
  const publicReadyStatusPolicy =
    contract.runDiscipline?.runArtifactValidation
      ?.productGatePublicReadyStatusPolicy ?? {};
  assert(
    publicReadyStatusPolicy.enabled === true &&
      Array.isArray(publicReadyStatusPolicy.packetStatusFields),
    "workflow-contract.json runArtifactValidation.productGatePublicReadyStatusPolicy must be enabled.",
  );
  for (const packet of [
    ...productGatePolicy.requiredPackets,
    ...productGatePolicy.requiredSideEffectPackets,
  ]) {
    assert(
      publicReadyStatusPolicy.packetStatusFields.some(
        (entry) => entry.packet === packet,
      ),
      `workflow-contract.json productGatePublicReadyStatusPolicy.packetStatusFields must include ${packet}.`,
    );
  }
  for (const [protocolName, expectedFields] of [
    [
      "taskClassification",
      [
        "taskClass",
        "requestClass",
        "queryScope",
        "projectRef",
        "registryStatus",
        "crossProjectReason",
        "governanceFlow",
        "triggerReasons",
        "upgradeReasons",
        "bypassReasons",
        "ownerRequired",
        "decisionSource",
        "classifierVersion",
        "complexity",
      ],
    ],
    [
      "fetchPacket",
      [
        "projectsChecked",
        "projectLocalSources",
        "globalRegistryHits",
        "capabilityMatches",
        "capabilityGaps",
        "graphSources",
        "knowledgeSources",
      ],
    ],
    [
      "intentGatePacket",
      [
        "ambiguitiesResolved",
        "requiresUserChoice",
        "defaultAssumptions",
        "pendingUserChoices",
        "userLanguage",
        "languageSource",
        "nativeChoiceSurface",
        "intentGatePacketVersion",
      ],
    ],
    [
      "cardPlanPacket",
      [
        "dealerOwner",
        "dealerMode",
        "cards",
        "deliveryShells",
        "silenceDecision",
        "controlDecisions",
        "defaultShellId",
      ],
    ],
    [
      "dispatchEnvelopePacket",
      [
        "ownerAgent",
        "businessRoleId",
        "roleDisplayName",
        "roleInstanceId",
        "taskRef",
        "allowedCapabilities",
        "blockedCapabilities",
        "route",
        "ownerSelection",
        "memoryMode",
        "workspaceHint",
        "resultSchemaRef",
        "reviewOwner",
        "verificationOwner",
      ],
    ],
    [
      "orchestrationTaskBoardPacket",
      ["dispatchBoardId", "boardMode", "tasks", "synthesisOwner"],
    ],
    [
      "orchestrationTask",
      [
        "taskId",
        "taskKind",
        "owner",
        "businessRoleId",
        "roleDisplayName",
        "sequence",
        "dependsOn",
        "deliverable",
      ],
    ],
    [
      "businessFlowBlueprintPacket",
      [
        "deliverableType",
        "requiredLanes",
        "optionalLanes",
        "omittedLanes",
        "laneDependencies",
        "coverageJudgment",
        "blueprintSource",
        "blueprintVersion",
      ],
    ],
    [
      "productCompletenessPacket",
      [
        "outcome",
        "userValue",
        "acceptanceCriteria",
        "nonGoals",
        "designDimensions",
        "completenessStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "experienceQualityPacket",
      [
        "audience",
        "criticalJourneys",
        "qualityAttributes",
        "accessibilityConsiderations",
        "experienceDimensions",
        "experienceStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "testStrategyPacket",
      [
        "strategy",
        "requiredTestTypes",
        "executedTests",
        "deferredTests",
        "coverageRationale",
        "testDimensions",
        "testStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "structureHygienePacket",
      [
        "changedAreas",
        "boundaryChecks",
        "orphanCleanup",
        "namingAndLayoutChecks",
        "structureDimensions",
        "hygieneStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "permissionMatrixPacket",
      [
        "accessedResources",
        "permissionChecks",
        "secretsPolicy",
        "permissionDimensions",
        "permissionStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "sideEffectLedgerPacket",
      [
        "sideEffects",
        "externalSystemsTouched",
        "stateChanges",
        "mitigations",
        "sideEffectDimensions",
        "sideEffectStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "rollbackPlanPacket",
      [
        "rollbackScope",
        "rollbackTriggers",
        "rollbackSteps",
        "affectedArtifacts",
        "rollbackDimensions",
        "rollbackStatus",
        "owner",
        "evidenceRefs",
      ],
    ],
    [
      "agentBlueprintPacket",
      [
        "roles",
        "roleCoverageGate",
        "missingRoles",
        "duplicateRolePolicy",
        "namingPolicy",
      ],
    ],
    [
      "capabilityGapPacket",
      [
        "gapId",
        "requestedCapability",
        "currentAgentsChecked",
        "insufficiencyReason",
        "resolutionAction",
        "requestedBy",
        "approvedBy",
      ],
    ],
    [
      "executionAgentCard",
      [
        "agentId",
        "businessRoleId",
        "roleDisplayName",
        "purpose",
        "capabilities",
        "nonCapabilities",
        "dependencies",
        "inputs",
        "outputs",
      ],
    ],
    [
      "workerTaskPacket",
      [
        "taskPacketId",
        "owner",
        "ownerMode",
        "ownerAgent",
        "businessRoleId",
        "roleDisplayName",
        "roleInstanceId",
        "runtimeInstanceAlias",
        "todayTask",
        "output",
        "deliverableLink",
        "qualityBar",
        "referenceDirection",
        "handoffTarget",
        "lengthExpectation",
        "visualOrAssetPlan",
        "dependsOn",
        "parallelGroup",
        "mergeOwner",
        "shardKey",
        "shardScope",
        "workspaceIsolation",
        "artifactNamespace",
        "collisionPolicy",
        "verifySteps",
      ],
    ],
    [
      "cardDecision",
      [
        "cardId",
        "cardType",
        "cardIntent",
        "cardDecision",
        "cardAudience",
        "cardTiming",
        "cardShell",
        "cardPriority",
        "cardReason",
        "cardSource",
        "cardSuppressed",
        "suppressionReason",
        "deliveryShellId",
        "choiceSurface",
        "userLanguage",
      ],
    ],
    [
      "deliveryShell",
      [
        "deliveryShellId",
        "shellType",
        "presentationMode",
        "exposureLevel",
        "interventionForm",
        "audience",
        "contentBoundary",
        "userLanguage",
        "languageSource",
      ],
    ],
    [
      "silenceDecision",
      [
        "silenceDecision",
        "noInterventionPreferred",
        "interruptionJustified",
        "deferUntil",
        "reasonForSilence",
      ],
    ],
    [
      "controlDecision",
      [
        "decisionId",
        "decisionType",
        "skipReason",
        "interruptReason",
        "overrideReason",
        "insertedGovernanceOwner",
        "emergencyGovernanceTriggered",
        "returnsToStage",
        "rejoinCondition",
      ],
    ],
    [
      "reviewFinding",
      [
        "findingId",
        "severity",
        "owner",
        "sourceProject",
        "summary",
        "requiredAction",
        "fixArtifact",
        "verifiedBy",
        "closeState",
      ],
    ],
    [
      "revisionResponse",
      [
        "findingId",
        "actionId",
        "owner",
        "responseType",
        "status",
        "fixArtifact",
        "responseSummary",
      ],
    ],
    [
      "verificationResult",
      ["findingId", "verifiedBy", "result", "evidence", "closeState"],
    ],
    [
      "summaryPacket",
      [
        "verifyPassed",
        "summaryClosed",
        "singleDeliverableMaintained",
        "deliverableChainClosed",
        "consolidatedDeliverablePresent",
        "publicReady",
        "sourceProjects",
        "deliveryShellsUsed",
        "blockedBy",
      ],
    ],
  ]) {
    const fields = contract.protocols?.[protocolName]?.requiredFields ?? [];
    for (const field of expectedFields) {
      assert(
        fields.includes(field),
        `workflow-contract.json protocol ${protocolName} must require ${field}.`,
      );
    }
  }

  const businessFlowProtocol =
    contract.protocols?.businessFlowBlueprintPacket ?? {};
  for (const field of [
    "laneId",
    "businessLane",
    "capabilityNeed",
    "capabilitySearchQuery",
    "candidateOwners",
    "matchedCapabilities",
    "capabilityBindings",
    "selectedOwner",
    "selectionReason",
    "coverageStatus",
  ]) {
    assert(
      businessFlowProtocol.laneRequiredFields?.includes(field),
      `workflow-contract.json businessFlowBlueprintPacket.laneRequiredFields must include ${field}.`,
    );
  }
  assert(
    businessFlowProtocol.laneCompatibilityFields?.includes("candidateSkills"),
    "workflow-contract.json businessFlowBlueprintPacket must keep candidateSkills as a compatibility field only.",
  );
  for (const status of [
    "covered",
    "partial",
    "missing",
    "omitted_with_reason",
  ]) {
    assert(
      businessFlowProtocol.laneCoverageStatusEnum?.includes(status),
      `workflow-contract.json businessFlowBlueprintPacket.laneCoverageStatusEnum must include ${status}.`,
    );
  }
  for (const deliverableType of ["runtime_package", "install_release"]) {
    assert(
      businessFlowProtocol.deliverableTypeEnum?.includes(deliverableType),
      `workflow-contract.json businessFlowBlueprintPacket.deliverableTypeEnum must include ${deliverableType}.`,
    );
  }
  for (const deliverableType of [
    "internal_api_integration",
    "third_party_integration",
  ]) {
    assert(
      businessFlowProtocol.deliverableTypeEnum?.includes(deliverableType),
      `workflow-contract.json businessFlowBlueprintPacket.deliverableTypeEnum must include ${deliverableType}.`,
    );
  }
  for (const laneId of ["release", "install", "runtime_package"]) {
    assert(
      businessFlowProtocol.releaseInstallLaneIds?.includes(laneId),
      `workflow-contract.json businessFlowBlueprintPacket.releaseInstallLaneIds must include ${laneId}.`,
    );
  }
  for (const laneId of [
    "interface_contract",
    "provider_adapter",
    "permission",
    "contract_test",
    "observability",
    "rollout_rollback",
  ]) {
    assert(
      businessFlowProtocol.interfaceIntegrationLaneIds?.includes(laneId),
      `workflow-contract.json businessFlowBlueprintPacket.interfaceIntegrationLaneIds must include ${laneId}.`,
    );
  }

  const integrationProtocol =
    contract.protocols?.interfaceIntegrationContractPacket ?? {};
  for (const field of [
    "integrationKind",
    "interfaceInventory",
    "fieldLedger",
    "unknowns",
    "evidence",
    "reviewGates",
    "testMatrix",
    "ownerApprovals",
  ]) {
    assert(
      integrationProtocol.requiredFields?.includes(field),
      `workflow-contract.json interfaceIntegrationContractPacket.requiredFields must include ${field}.`,
    );
  }
  for (const kind of ["internal", "third_party", "hybrid"]) {
    assert(
      integrationProtocol.integrationKindEnum?.includes(kind),
      `workflow-contract.json interfaceIntegrationContractPacket.integrationKindEnum must include ${kind}.`,
    );
  }
  for (const scenario of [
    "success",
    "auth_failure",
    "rate_limited",
    "timeout",
    "missing_field",
    "provider_5xx",
    "duplicate_request_or_callback",
  ]) {
    assert(
      integrationProtocol.testMatrixRequiredScenarios?.includes(scenario),
      `workflow-contract.json interfaceIntegrationContractPacket.testMatrixRequiredScenarios must include ${scenario}.`,
    );
  }

  const agentBlueprintProtocol = contract.protocols?.agentBlueprintPacket ?? {};
  for (const field of [
    "businessRoleId",
    "roleDisplayName",
    "assignedResponsibilitySlice",
    "ownerAgent",
    "ownerSource",
    "agentCopyPolicy",
    "ownerResponsibilityDelta",
    "agentIterationPlan",
    "ownerResolution",
    "skillSelectionScope",
    "governanceStageNodes",
  ]) {
    assert(
      agentBlueprintProtocol.roleRequiredFields?.includes(field),
      `workflow-contract.json agentBlueprintPacket.roleRequiredFields must include ${field}.`,
    );
  }
  assert(
    agentBlueprintProtocol.compatibilityFields?.includes("matchedSkills"),
    "workflow-contract.json agentBlueprintPacket must keep matchedSkills as a compatibility field.",
  );
  for (const field of ["matchedCapabilities", "capabilityBindings"]) {
    assert(
      agentBlueprintProtocol.capabilityMatchFields?.includes(field),
      `workflow-contract.json agentBlueprintPacket.capabilityMatchFields must include ${field}.`,
    );
  }
  for (const bindingType of [
    "agent",
    "skill",
    "command",
    "mcp_tool",
    "runtime_tool",
    "file_set",
    "capability_index_query",
    "contract_ref",
    "graph_node_set",
  ]) {
    assert(
      agentBlueprintProtocol.capabilityBindingTypeEnum?.includes(bindingType),
      `workflow-contract.json agentBlueprintPacket.capabilityBindingTypeEnum must include ${bindingType}.`,
    );
  }
  assert(
    agentBlueprintProtocol.namingPolicy?.businessSemanticNamesOnly === true &&
      agentBlueprintProtocol.namingPolicy?.shortRoleNamesRequired === true &&
      agentBlueprintProtocol.namingPolicy?.runtimeNicknamesAreAliasesOnly ===
        true &&
      agentBlueprintProtocol.namingPolicy?.roleDisplayNameRequired === true &&
      agentBlueprintProtocol.namingPolicy?.scopeDetailsBelongInInstanceFields ===
        true,
    "workflow-contract.json agentBlueprintPacket.namingPolicy must be the contract object with short business role name rules.",
  );
  const longTermCapabilityPolicy =
    agentBlueprintProtocol.longTermCapabilityPolicy ?? {};
  assert(
    longTermCapabilityPolicy.abstractCapabilitySlotsRequired === true &&
      longTermCapabilityPolicy.forbidConcreteSkillInLongTermAgentIdentity ===
        true &&
      longTermCapabilityPolicy.selectedSkillScope === "run_only" &&
      longTermCapabilityPolicy.openSourceProjectKeepsGovernanceMetaAgentsOnly ===
        true &&
      longTermCapabilityPolicy.nonGovernanceExecutionAgentsIgnoredInPublicRepo ===
        true &&
      longTermCapabilityPolicy.globalAgentDirectReusePreferred === true &&
      longTermCapabilityPolicy.copyGlobalAgentOnlyWhenModified === true,
    "workflow-contract.json agentBlueprintPacket.longTermCapabilityPolicy must require abstract slots, run-only concrete skill selection, open-source governance-only owners, direct global reuse, copy-only-when-modified, and no fixed concrete child skills in long-term identity.",
  );
  const globalAgentReusePolicy =
    agentBlueprintProtocol.globalAgentReusePolicy ?? {};
  assert(
    globalAgentReusePolicy.searchGlobalBeforeCopy === true &&
      globalAgentReusePolicy.directUseDoesNotCopyToProject === true &&
      globalAgentReusePolicy.copyToProjectOnlyWhen?.includes(
        "project_specific_knowledge_required",
      ) &&
      globalAgentReusePolicy.copyToProjectOnlyWhen?.includes(
        "capability_boundary_must_change",
      ),
    "workflow-contract.json agentBlueprintPacket.globalAgentReusePolicy must search global first, use matching global agents directly, and copy only when modification is required.",
  );
  for (const ownerSource of [
    "meta_kim_canonical",
    "global_reuse",
    "project_local",
  ]) {
    assert(
      agentBlueprintProtocol.ownerSourceEnum?.includes(ownerSource),
      `workflow-contract.json agentBlueprintPacket.ownerSourceEnum must include ${ownerSource}.`,
    );
  }
  for (const copyPolicy of [
    "meta_kim_governance_only",
    "use_global_directly",
    "copy_to_project_for_modification",
    "create_project_local_agent",
    "already_project_local",
  ]) {
    assert(
      agentBlueprintProtocol.agentCopyPolicyEnum?.includes(copyPolicy),
      `workflow-contract.json agentBlueprintPacket.agentCopyPolicyEnum must include ${copyPolicy}.`,
    );
  }
  for (const provider of [
    "agent-teams-playbook",
    "superpowers",
    "ecc",
    "findskill",
  ]) {
    assert(
      longTermCapabilityPolicy.allowedMetaSkillProviders?.includes(provider),
      `workflow-contract.json agentBlueprintPacket.longTermCapabilityPolicy.allowedMetaSkillProviders must include ${provider}.`,
    );
  }
  assert(
    Array.isArray(longTermCapabilityPolicy.forbiddenConcreteSkillPatterns) &&
      longTermCapabilityPolicy.forbiddenConcreteSkillPatterns.length >= 1,
    "workflow-contract.json agentBlueprintPacket.longTermCapabilityPolicy must declare forbidden concrete child-skill binding patterns.",
  );
  assert(
    longTermCapabilityPolicy.oversizedGovernanceAgentPolicy
      ?.exceptionRequiresReason === true &&
      longTermCapabilityPolicy.oversizedGovernanceAgentPolicy
        ?.splitDocumentationAllowed === true,
    "workflow-contract.json agentBlueprintPacket.longTermCapabilityPolicy must document oversized governance agent exception and split-documentation policy.",
  );
  for (const resolution of [
    "reuse_existing_owner",
    "upgrade_existing_owner",
    "create_owner_first",
  ]) {
    assert(
      agentBlueprintProtocol.ownerResolutionEnum?.includes(resolution),
      `workflow-contract.json agentBlueprintPacket.ownerResolutionEnum must include ${resolution}.`,
    );
  }
  const roleCoverageRule =
    contract.runDiscipline?.protocolFirst
      ?.capabilityGapPacketRequiredWhenRoleCoverage ?? {};
  assert(
    roleCoverageRule.roleCoverageGate === "fail" &&
      roleCoverageRule.missingRolesNonEmpty === true &&
      roleCoverageRule.ownerResolutionAnyOf?.includes("upgrade_existing_owner") &&
      roleCoverageRule.ownerResolutionAnyOf?.includes("create_owner_first"),
    "workflow-contract.json must require capabilityGapPacket for failed role coverage, missing roles, and owner creation or upgrade.",
  );
  for (const resolution of ["upgrade_existing_owner", "create_owner_first"]) {
    assert(
      contract.runDiscipline?.protocolFirst?.governanceOwnerDecisionRequiredWhenOwnerResolutionAnyOf?.includes(
        resolution,
      ),
      `workflow-contract.json governanceOwnerDecisionRequiredWhenOwnerResolutionAnyOf must include ${resolution}.`,
    );
  }

  const governanceStagePolicy =
    agentBlueprintProtocol.governanceStageCoveragePolicy ?? {};
  for (const stage of ["Critical", "Fetch", "Thinking", "Review"]) {
    assert(
      governanceStagePolicy.requiredStages?.includes(stage),
      `workflow-contract.json governanceStageCoveragePolicy.requiredStages must include ${stage}.`,
    );
    assert(
      Array.isArray(governanceStagePolicy.stageAllowedAgents?.[stage]) &&
        governanceStagePolicy.stageAllowedAgents[stage].every((agent) =>
          governanceStagePolicy.allowedOwnerAgents?.includes(agent),
        ),
      `workflow-contract.json governanceStageCoveragePolicy.stageAllowedAgents.${stage} must contain only allowed governance meta agents.`,
    );
    assert(
      Array.isArray(governanceStagePolicy.stageRequiredAgents?.[stage]) &&
        governanceStagePolicy.stageRequiredAgents[stage].length >= 1 &&
        governanceStagePolicy.stageRequiredAgents[stage].every((agent) =>
          governanceStagePolicy.stageAllowedAgents[stage].includes(agent),
        ),
      `workflow-contract.json governanceStageCoveragePolicy.stageRequiredAgents.${stage} must contain required agents that are allowed for the stage.`,
    );
  }
  for (const agentId of [
    "meta-warden",
    "meta-conductor",
    "meta-genesis",
    "meta-artisan",
    "meta-sentinel",
    "meta-librarian",
    "meta-prism",
    "meta-scout",
    "meta-chrysalis",
  ]) {
    assert(
      governanceStagePolicy.allowedOwnerAgents?.includes(agentId),
      `workflow-contract.json governanceStageCoveragePolicy.allowedOwnerAgents must include ${agentId}.`,
    );
  }
  assert(
    governanceStagePolicy.skillSelectionScope === "run_scoped",
    "workflow-contract.json governanceStageCoveragePolicy.skillSelectionScope must be run_scoped.",
  );
  assert(
    governanceStagePolicy.factoryResolutionAdditionalRequiredAgents
      ?.appliesWhenResolutionActionAnyOf?.includes("create_execution_agent") &&
      governanceStagePolicy.factoryResolutionAdditionalRequiredAgents
        ?.appliesWhenResolutionActionAnyOf?.includes("upgrade_execution_agent") &&
      governanceStagePolicy.factoryResolutionAdditionalRequiredAgents?.Review?.includes(
        "meta-chrysalis",
      ),
    "workflow-contract.json governanceStageCoveragePolicy must require Chrysalis review participation for execution-agent creation or upgrade.",
  );

  const sameOwnerPolicy =
    contract.protocols?.workerTaskPacket?.sameOwnerMultiInstancePolicy ?? {};
  assert(
    sameOwnerPolicy.allowed === true &&
      sameOwnerPolicy.roleInstanceIdUniqueWithinRun === true &&
      sameOwnerPolicy.sameOwnerParallelGroupRequiresUnifiedMergeOwner === true,
    "workflow-contract.json workerTaskPacket.sameOwnerMultiInstancePolicy must allow only sharded same-owner instances with unified mergeOwner.",
  );
  for (const field of [
    "roleInstanceId",
    "shardKey",
    "shardScope",
    "workspaceIsolation",
    "artifactNamespace",
    "collisionPolicy",
    "mergeOwner",
  ]) {
    assert(
      sameOwnerPolicy.requiredFields?.includes(field),
      `workflow-contract.json workerTaskPacket.sameOwnerMultiInstancePolicy.requiredFields must include ${field}.`,
    );
  }
  for (const policy of [
    "no_overlap",
    "merge_by_owner",
    "lock_required",
    "sequentialize",
  ]) {
    assert(
      sameOwnerPolicy.collisionPolicyEnum?.includes(policy),
      `workflow-contract.json workerTaskPacket.sameOwnerMultiInstancePolicy.collisionPolicyEnum must include ${policy}.`,
    );
  }

  const verificationPacketFields =
    contract.protocols?.verificationPacket?.requiredFields ?? [];
  for (const field of [
    "verified",
    "remainingIssues",
    "evidence",
    "fixEvidence",
    "revisionResponses",
    "verificationResults",
    "closeFindings",
  ]) {
    assert(
      verificationPacketFields.includes(field),
      `workflow-contract.json verificationPacket must require ${field}.`,
    );
  }

  assert(
    contract.runDiscipline?.evolutionDecision?.required === true,
    "workflow-contract.json must require an explicit evolution decision.",
  );
  for (const field of ["writeback", "none"]) {
    assert(
      contract.runDiscipline?.evolutionDecision?.allowedDecisions?.includes(
        field,
      ),
      `workflow-contract.json evolutionDecision.allowedDecisions must include ${field}.`,
    );
  }
  assert(
    contract.runDiscipline?.evolutionDecision?.noneRequiresReason === true &&
      contract.runDiscipline?.evolutionDecision?.writebackRequiresTargets ===
        true,
    "workflow-contract.json evolutionDecision must require either writeback targets or an explicit reason.",
  );
  const evolutionFields =
    contract.protocols?.evolutionWritebackPacket?.requiredFields ?? [];
  for (const field of [
    "ownerAssessment",
    "writebackDecision",
    "decisionReason",
    "writebacks",
    "retain",
    "upgrade",
    "retire",
    "scarIds",
    "syncRequired",
  ]) {
    assert(
      evolutionFields.includes(field),
      `workflow-contract.json evolutionWritebackPacket must require ${field}.`,
    );
  }
  const publicDisplayGate = contract.runDiscipline?.publicDisplayGate;
  for (const field of [
    "hardReleaseGate",
    "blockDisplayBeforeVerification",
    "blockDisplayBeforeSummaryClosure",
    "blockCompletionBeforeDeliverableClosure",
  ]) {
    assert(
      publicDisplayGate?.[field] === true,
      `workflow-contract.json publicDisplayGate must set ${field} to true.`,
    );
  }

  const runArtifactValidation = contract.runDiscipline?.runArtifactValidation;
  assert(
    runArtifactValidation?.script === "scripts/validate-run-artifact.mjs",
    "workflow-contract.json must point runArtifactValidation to scripts/validate-run-artifact.mjs.",
  );
  for (const field of [
    "findingLineageRequired",
    "deliverableLinkMustReferencePrimaryDeliverable",
    "summaryPacketRequired",
    "cardPlanPacketRequired",
    "orchestrationTaskBoardPacketRequired",
    "productGatePacketsRequiredForNonQuery",
    "sideEffectAndRollbackPacketsRequiredForNonQuery",
    "workerDependencyDagValidationRequired",
    "matchedCapabilitiesOrLegacyMatchedSkillsRequired",
  ]) {
    assert(
      runArtifactValidation?.[field] === true,
      `workflow-contract.json runArtifactValidation must set ${field} to true.`,
    );
  }
  assert(
    runArtifactValidation?.publicReadyField === "summaryPacket.publicReady",
    "workflow-contract.json runArtifactValidation must point publicReadyField to summaryPacket.publicReady.",
  );

  assert(
    contract.departmentVisualPolicies?.game?.defaultMode ===
      "generate_or_self_create",
    "workflow-contract.json game visual policy must default to generate_or_self_create.",
  );
  assert(
    contract.departmentVisualPolicies?.ai?.defaultMode ===
      "official_or_verified_reference",
    "workflow-contract.json ai visual policy must default to official_or_verified_reference.",
  );
}



function assertSchemaRequired(schemaNode, value, label) {
  for (const field of schemaNode.required ?? []) {
    assert(
      Object.prototype.hasOwnProperty.call(value ?? {}, field),
      `${label} must include schema-required field ${field}.`,
    );
  }
}

function assertSchemaEnum(schemaNode, value, label) {
  if (!schemaNode?.enum) {
    return;
  }
  assert(
    schemaNode.enum.includes(value),
    `${label} must be one of ${schemaNode.enum.join(", ")}.`,
  );
}

function assertSchemaConst(schemaNode, value, label) {
  if (!Object.prototype.hasOwnProperty.call(schemaNode ?? {}, "const")) {
    return;
  }
  assert(value === schemaNode.const, `${label} must equal ${schemaNode.const}.`);
}

function assertNoAdditionalSchemaProperties(schemaNode, value, label) {
  if (schemaNode.additionalProperties !== false) {
    return;
  }
  const allowed = new Set(Object.keys(schemaNode.properties ?? {}));
  const extras = Object.keys(value ?? {}).filter((key) => !allowed.has(key));
  assert(
    extras.length === 0,
    `${label} has fields not declared in capability-index.schema.json: ${extras.join(", ")}.`,
  );
}

async function validateCapabilityIndexSchema(index) {
  const schemaPath = path.join(
    repoRoot,
    "config",
    "contracts",
    "capability-index.schema.json",
  );
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));

  assert(schema.type === "object", "capability-index.schema.json root must be an object schema.");
  assertSchemaRequired(schema, index, "capability index");
  assertNoAdditionalSchemaProperties(schema, index, "capability index");
  assertSchemaEnum(schema.properties.scope, index.scope, "capability index scope");
  for (const field of [
    "abstractCapabilitySlots",
    "metaSkillProviders",
    "runtimeSelectedSkills",
    "longTermAgentIdentityPolicy",
  ]) {
    assert(
      Object.prototype.hasOwnProperty.call(schema.properties, field),
      `capability-index.schema.json must define ${field}.`,
    );
  }

  const fetchOrderSchema = schema.properties.fetchOrder;
  assert(Array.isArray(index.fetchOrder), "capability index fetchOrder must be an array.");
  for (const [position, item] of index.fetchOrder.entries()) {
    assertSchemaEnum(
      fetchOrderSchema.items,
      item,
      `capability index fetchOrder[${position}]`,
    );
  }

  const groupsSchema = schema.properties.byCapabilityType.properties;
  assert(index.byCapabilityType && typeof index.byCapabilityType === "object", "capability index byCapabilityType must be an object.");

  assert(
    Array.isArray(index.abstractCapabilitySlots) &&
      index.abstractCapabilitySlots.length >= 1,
    "capability index must declare at least one abstractCapabilitySlots entry.",
  );
  for (const [position, slot] of index.abstractCapabilitySlots.entries()) {
    assertSchemaRequired(
      schema.properties.abstractCapabilitySlots.items,
      slot,
      `capability index abstractCapabilitySlots[${position}]`,
    );
    assert(
      slot.selectedSkillScope === "run_only",
      `capability index abstractCapabilitySlots[${position}].selectedSkillScope must be run_only.`,
    );
    assert(
      Array.isArray(slot.allowedProviderIds) &&
        slot.allowedProviderIds.length >= 1,
      `capability index abstractCapabilitySlots[${position}] must list allowedProviderIds.`,
    );
  }
  assert(
    index.runtimeSelectedSkills?.selectedSkillScope === "run_only",
    "capability index runtimeSelectedSkills.selectedSkillScope must be run_only.",
  );
  assert(
    index.longTermAgentIdentityPolicy
      ?.forbidConcreteSkillInLongTermAgentIdentity === true,
    "capability index longTermAgentIdentityPolicy must forbid concrete skills in long-term agent identity.",
  );
  for (const provider of [
    "agent-teams-playbook",
    "superpowers",
    "ecc",
    "findskill",
  ]) {
    const providerEntry = index.metaSkillProviders?.[provider];
    assert(
      providerEntry?.providerKind === "meta-skill-package" &&
        providerEntry?.allowedForLongTermAgentIdentity === true &&
        providerEntry?.concreteSubSkillBindingForbidden === true,
      `capability index metaSkillProviders.${provider} must be an allowed meta-skill package provider with concrete child-skill binding forbidden.`,
    );
    assert(
      index.longTermAgentIdentityPolicy?.allowedMetaSkillProviderIds?.includes(
        provider,
      ),
      `capability index longTermAgentIdentityPolicy.allowedMetaSkillProviderIds must include ${provider}.`,
    );
  }
  assert(
    Array.isArray(
      index.longTermAgentIdentityPolicy?.forbiddenConcreteSkillPatterns,
    ) &&
      index.longTermAgentIdentityPolicy.forbiddenConcreteSkillPatterns.length >=
        1,
    "capability index longTermAgentIdentityPolicy must declare forbidden concrete child-skill binding patterns.",
  );

  const agentSchema = groupsSchema.agents.additionalProperties;
  for (const [key, entry] of Object.entries(index.byCapabilityType.agents ?? {})) {
    assertSchemaRequired(agentSchema, entry, `capability index agent ${key}`);
    assertSchemaConst(agentSchema.properties.type, entry.type, `capability index agent ${key}.type`);
    assertSchemaEnum(agentSchema.properties.layer, entry.layer, `capability index agent ${key}.layer`);
    if (entry.layer === "meta") {
      assert(
        entry.executionBlock === true,
        `capability index agent ${key} must set executionBlock=true for meta layer.`,
      );
    }
  }

  const skillSchema = groupsSchema.skills.additionalProperties;
  for (const [key, entry] of Object.entries(index.byCapabilityType.skills ?? {})) {
    assertSchemaRequired(skillSchema, entry, `capability index skill ${key}`);
    assertSchemaConst(skillSchema.properties.type, entry.type, `capability index skill ${key}.type`);
  }

  const governanceRules = index.governanceRules ?? {};
  const governanceSchema = schema.properties.governanceRules?.properties ?? {};
  assertSchemaConst(
    governanceSchema.metaAgentDispatchRule,
    governanceRules.metaAgentDispatchRule,
    "capability index governanceRules.metaAgentDispatchRule",
  );
  assertSchemaConst(
    governanceSchema.fallbackBehavior,
    governanceRules.fallbackBehavior,
    "capability index governanceRules.fallbackBehavior",
  );
}

async function validateCapabilityIndex() {
  const indexPath = path.join(
    canonicalCapabilityIndexDir,
    "meta-kim-capabilities.json",
  );
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  await validateCapabilityIndexSchema(index);
  assert(
    index.scope === "repo-canonical",
    "config/capability-index/meta-kim-capabilities.json must be a repo-canonical index.",
  );
  assert(
    index.canonicalProjection === CANONICAL_CAPABILITY_INDEX_RELATIVE,
    "capability index must identify config/capability-index/meta-kim-capabilities.json as canonicalProjection.",
  );
  assert(
    index.localGlobalInventory === LOCAL_GLOBAL_CAPABILITY_INVENTORY_PATTERN,
    "capability index must point global inventory to .meta-kim/state/{profile}/capability-index/global-capabilities.json.",
  );
  assert(
    Array.isArray(index.fetchOrder) &&
      index.fetchOrder.join(" -> ") ===
        "repo canonical capability index -> runtime mirror -> local global inventory -> fallback general agent with capability gap record",
    "capability index fetchOrder must be canonical -> mirror -> local inventory -> fallback.",
  );

  const serialized = JSON.stringify(index);
  const homeDir = os.homedir().replace(/\\/g, "\\\\");
  assert(
    !serialized.includes(homeDir),
    "repo-canonical capability index must not contain machine-specific home paths.",
  );

  const indexedAgentPaths = new Set(
    Object.values(index.byCapabilityType?.agents ?? {}).map((entry) => entry.path),
  );
  const canonicalAgentFiles = (await fs.readdir(canonicalAgentsDir))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `canonical/agents/${file}`)
    .sort();
  const missingAgents = canonicalAgentFiles.filter(
    (agentPath) => !indexedAgentPaths.has(agentPath),
  );
  assert(
    missingAgents.length === 0,
    `capability index is missing canonical agents: ${missingAgents.join(", ")}.`,
  );

  const indexedSkillPaths = new Set(
    Object.values(index.byCapabilityType?.skills ?? {}).map((entry) => entry.path),
  );
  const canonicalSkillManifests = await listCanonicalSkillManifests();
  const missingSkills = canonicalSkillManifests
    .map((skill) => skill.path)
    .filter((skillPath) => !indexedSkillPaths.has(skillPath));
  assert(
    missingSkills.length === 0,
    `capability index is missing canonical skills: ${missingSkills.join(", ")}.`,
  );

  const canonicalContent = await fs.readFile(indexPath, "utf8");
  for (const mirror of index.mirroredTo ?? []) {
    const mirrorPath = path.join(repoRoot, mirror);
    assert(await exists(mirrorPath), `Missing capability index mirror: ${mirror}.`);
    const mirroredContent = await fs.readFile(mirrorPath, "utf8");
    assert(
      mirroredContent === canonicalContent,
      `${mirror} must be byte-for-byte identical to ${CANONICAL_CAPABILITY_INDEX_RELATIVE}.`,
    );
  }
}


async function validateDocumentationFacts() {
  const docs = await walkFilesByExtensions(repoRoot, [".md"]);
  const packageJson = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8"),
  );
  const scripts = packageJson.scripts ?? {};

  for (const docPath of docs) {
    const relativePath = toRepoRelative(docPath);
    const raw = await fs.readFile(docPath, "utf8");
    assert(
      !raw.includes("docs/meta.md"),
      `${relativePath} must not reference docs/meta.md as a theory source.`,
    );
    assert(
      !/\.claude\/(?:agents|skills|capability-index)[^\n]*(?:canonical|主源|source of truth|source layer)/i.test(
        raw,
      ),
      `${relativePath} must not describe .claude projections as canonical sources.`,
    );
    assert(
      !/(?:canonical|主源|source of truth|source layer)[^\n]*\.claude\/(?:agents|skills|capability-index)/i.test(
        raw,
      ),
      `${relativePath} must not describe .claude projections as canonical sources.`,
    );

    for (const scriptName of getNpmScriptReferences(raw)) {
      assert(
        scripts[scriptName],
        `${relativePath} references missing npm script: ${scriptName}`,
      );
    }
  }

  for (const relativePath of [
    "canonical/skills/meta-theory/SKILL.md",
    "canonical/skills/meta-theory/references/meta-theory.md",
    ".codex/skills/meta-theory/SKILL.md",
    ".cursor/skills/meta-theory/SKILL.md",
    "openclaw/skills/meta-theory/SKILL.md",
  ]) {
    assert(
      await exists(path.join(repoRoot, relativePath)),
      `Documented runtime skill path is missing: ${relativePath}`,
    );
  }

  const testFiles = await walkFilesByExtensions(path.join(repoRoot, "tests"), [
    ".mjs",
  ]);
  const knownGapsPath = path.join(
    repoRoot,
    "tests",
    "fixtures",
    "known-doc-gaps.json",
  );
  const knownDocGaps = (await exists(knownGapsPath))
    ? JSON.parse(await fs.readFile(knownGapsPath, "utf8"))
    : [];
  for (const filePath of testFiles) {
    const raw = await fs.readFile(filePath, "utf8");
    const relativePath = toRepoRelative(filePath);
    const docGapWarnings = [
      ...raw.matchAll(/console\.warn\(([\s\S]*?DOC GAP[\s\S]*?)\);/g),
    ];
    for (const warning of docGapWarnings) {
      const message = warning[1];
      const allowed = knownDocGaps.some(
        (entry) =>
          entry.path === relativePath &&
          message.includes(entry.messageContains) &&
          entry.owner &&
          entry.expiry &&
          entry.closeCondition,
      );
      assert(
        allowed,
        `${relativePath} has an untracked DOC GAP warning; add owner, expiry, and closeCondition to tests/fixtures/known-doc-gaps.json or convert it to a failing assertion.`,
      );
    }
  }

  await validateEnglishGovernanceFiles();
}

let _localizedTriggerExceptionsCache = null;
function loadLocalizedTriggerExceptions() {
  if (_localizedTriggerExceptionsCache !== null) return _localizedTriggerExceptionsCache;
  try {
    const configPath = path.resolve(
      repoRoot,
      "config",
      "contracts",
      "localized-trigger-exceptions.json",
    );
    const cfg = JSON.parse(readFileSync(configPath, "utf8"));
    const patterns = (cfg.patterns || [])
      .filter((p) => p.type === "regex")
      .map((p) => new RegExp(p.pattern));
    const literals = (cfg.literals || []).map((l) => l.value);
    _localizedTriggerExceptionsCache = { patterns, literals, source: "config" };
  } catch {
    _localizedTriggerExceptionsCache = {
      patterns: [/^\s*trigger:\s*"/],
      literals: [
        "`元理论`",
        "`仅分析`",
        "`只读`",
        '"不需要确认"',
        "`方案 A`",
        "当前以聊天确认卡展示，不是弹窗",
      ],
      source: "hardcoded-fallback",
    };
  }
  return _localizedTriggerExceptionsCache;
}

function isAllowedLocalizedTriggerLine(line) {
  const ex = loadLocalizedTriggerExceptions();
  for (const p of ex.patterns) if (p.test(line)) return true;
  for (const l of ex.literals) if (line.includes(l)) return true;
  return false;
}

async function readExistingTextFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!(await exists(absolutePath))) return null;
  return fs.readFile(absolutePath, "utf8");
}

async function validateNoHanOutsideAllowedTriggers(relativePath) {
  const raw = await readExistingTextFile(relativePath);
  if (raw === null) return;
  const lines = raw.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!/[\p{Script=Han}]/u.test(line)) continue;
    if (isAllowedLocalizedTriggerLine(line)) continue;
    throw new Error(
      `${relativePath}:${index + 1} must be English-only; localized trigger phrases are allowed only in trigger lines or explicit trigger examples.`,
    );
  }
}

async function validateEnglishGovernanceFiles() {
  const fixedPaths = [
    "AGENTS.md",
    "CLAUDE.md",
    "config/contracts/workflow-contract.json",
    "docs/runtime-coverage-audit.md",
    "canonical/runtime-assets/claude/commands/save-progress/SKILL.md",
    "canonical/skills/meta-theory/SKILL.md",
    "canonical/skills/meta-theory/references/dev-governance.md",
    "canonical/skills/meta-theory/references/create-agent.md",
    ".agents/skills/meta-theory/SKILL.md",
    ".codex/skills/meta-theory/SKILL.md",
    ".claude/skills/meta-theory/SKILL.md",
    ".cursor/skills/meta-theory/SKILL.md",
    "openclaw/skills/meta-theory/SKILL.md",
  ];

  const dynamicFiles = [
    ...(await walkFilesByExtensions(canonicalAgentsDir, [".md"])),
    ...(await walkFilesByExtensions(path.join(repoRoot, ".claude", "agents"), [
      ".md",
    ])),
    ...(await walkFilesByExtensions(path.join(repoRoot, ".cursor", "agents"), [
      ".md",
    ])),
    ...(await walkFilesByExtensions(
      path.join(repoRoot, "openclaw", "workspaces"),
      [".md"],
    )),
  ].filter((filePath) => /(?:^|[\\/])(?:AGENTS|SOUL)\.md$|[\\/]agents[\\/][^\\/]+\.md$/.test(filePath));

  const targetPaths = new Set([
    ...fixedPaths,
    ...dynamicFiles.map((filePath) => toRepoRelative(filePath)),
  ]);

  for (const relativePath of targetPaths) {
    await validateNoHanOutsideAllowedTriggers(relativePath);
  }
}


async function validateClaudeAgents() {
  const files = (await fs.readdir(canonicalAgentsDir))
    .filter((file) => file.endsWith(".md"))
    .sort();

  assert(files.length >= 1, "No canonical agent files found.");

  const ids = [];
  for (const file of files) {
    const filePath = path.join(canonicalAgentsDir, file);
    const raw = await fs.readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(raw, filePath);
    assert(frontmatter.name, `${file} is missing frontmatter name.`);
    assert(
      frontmatter.description,
      `${file} is missing frontmatter description.`,
    );
    assert(
      frontmatter.name === file.replace(/\.md$/, ""),
      `${file} frontmatter name must match filename.`,
    );
    assertNoForbiddenMarkers(raw, filePath);
    for (const marker of EXPECTED_AGENT_WEAPON_MARKERS[frontmatter.name] ??
      []) {
      assert(
        raw.includes(marker),
        `${file} must include weapon-pack marker ${marker}.`,
      );
    }
    ids.push(frontmatter.name);
  }

  const conductorPath = path.join(canonicalAgentsDir, "meta-conductor.md");
  const conductorRaw = await fs.readFile(conductorPath, "utf8");
  for (const marker of [
    "One run = one department = one thing",
    "sole primary deliverable",
    "All worker tasks must serve the same delivery chain",
    "Visual/Material Strategy",
  ]) {
    assert(
      conductorRaw.includes(marker),
      `meta-conductor.md must include ${marker}.`,
    );
  }

  const wardenPath = path.join(canonicalAgentsDir, "meta-warden.md");
  const wardenRaw = await fs.readFile(wardenPath, "utf8");
  for (const marker of [
    "exactly one department and one primary deliverable",
    "deliverable-chain discipline",
    "public-display discipline",
    "Visual strategy consistent with department nature",
  ]) {
    assert(
      wardenRaw.includes(marker),
      `meta-warden.md must include ${marker}.`,
    );
  }

  return ids;
}

async function validatePortableSkill() {
  const referenceFiles = await listCanonicalSkillReferences();
  const skillSourcePath = canonicalSkillPath;
  const skillSource = await fs.readFile(skillSourcePath, "utf8");

  for (const expected of [
    "name: meta-theory",
    "version:",
    "author:",
    "trigger:",
    "tools:",
  ]) {
    assert(
      skillSource.includes(expected),
      `Portable skill is missing ${expected}`,
    );
  }
  for (const marker of [
    "### Station Deliverable Contract (Mandatory)",
    "Required Genesis deliverables",
    "Required Artisan deliverables",
    "Required Conductor deliverables",
  ]) {
    assert(
      skillSource.includes(marker),
      `Portable skill is missing station-deliverable marker ${marker}.`,
    );
  }
  assertNoForbiddenMarkers(skillSource, skillSourcePath, ["AskUserQuestion"]);
  const frontmatterValidation = validateSkillFrontmatter(skillSource);
  assert(
    frontmatterValidation.ok,
    `Canonical meta-theory skill frontmatter is invalid: ${frontmatterValidation.message}.`,
  );

  for (const referenceFile of referenceFiles) {
    const canonicalReferencePath = path.join(
      canonicalSkillReferencesDir,
      referenceFile,
    );
    const canonicalReference = await fs.readFile(
      canonicalReferencePath,
      "utf8",
    );
    assertNoForbiddenMarkers(canonicalReference, canonicalReferencePath, [
      "AskUserQuestion",
    ]);
  }
}

async function validateSyncConfiguration() {
  const manifest = await loadSyncManifest();
  const profiles = await loadRuntimeProfiles(manifest);

  const supportedTargets = manifest.supportedTargets ?? [];
  const defaultTargets = manifest.defaultTargets ?? supportedTargets;
  const availableTargets = manifest.availableTargets ?? Object.keys(profiles);
  const generatedTargets = manifest.generatedTargets ?? {};
  const canonicalRoots = manifest.canonicalRoots ?? {};

  assert(
    supportedTargets.length >= 1,
    "config/sync.json must declare at least one supported target.",
  );
  assert(
    JSON.stringify([...supportedTargets].sort()) ===
      JSON.stringify(Object.keys(profiles).sort()),
    "config/sync.json supportedTargets must match the runtime target catalog.",
  );
  assert(
    defaultTargets.every((target) => supportedTargets.includes(target)),
    "config/sync.json defaultTargets must be a subset of supportedTargets.",
  );
  assert(
    availableTargets.every((target) =>
      Object.prototype.hasOwnProperty.call(profiles, target),
    ),
    "config/sync.json availableTargets must only reference known runtime targets.",
  );
  assert(
    supportedTargets.every(
      (target) =>
        Array.isArray(generatedTargets[target]) &&
        generatedTargets[target].length > 0,
    ),
    "config/sync.json must declare generatedTargets for every supported target.",
  );
  assert(
    canonicalRoots.skills === "canonical/skills",
    "config/sync.json canonicalRoots.skills must be canonical/skills.",
  );
  assert(
    canonicalRoots.contracts === "config/contracts",
    "config/sync.json canonicalRoots.contracts must be config/contracts.",
  );
  assert(
    canonicalRoots.capabilityIndex === "config/capability-index",
    "config/sync.json canonicalRoots.capabilityIndex must be config/capability-index.",
  );

  assert(
    profiles.codex.projection.outputPaths.skillsDir === ".codex/skills" &&
      profiles.codex.projection.outputPaths.skillRoot ===
        ".codex/skills/meta-theory" &&
      profiles.codex.projection.outputPaths.projectSkillsDir ===
        ".agents/skills" &&
      profiles.codex.projection.outputPaths.projectSkillRoot ===
        ".agents/skills/meta-theory",
    "Codex runtime profile must declare both the compatibility .codex/skills root and the official project .agents/skills root.",
  );
  assert(
    profiles.claude.projection.outputPaths.skillsDir === ".claude/skills" &&
      profiles.openclaw.projection.outputPaths.skillsDir === "openclaw/skills" &&
      profiles.cursor.projection.outputPaths.skillsDir === ".cursor/skills",
    "Runtime profiles must declare skillsDir for full canonical/skills projection.",
  );
  assert(
    profiles.codex.projection.outputPaths.hooksDir === ".codex/hooks" &&
      profiles.codex.projection.outputPaths.hooksFile === ".codex/hooks.json",
    "Codex runtime profile must declare hook output paths.",
  );
  assert(
    profiles.cursor.projection.assetTypes.includes("hooks") &&
      profiles.cursor.projection.outputPaths.hooksDir === ".cursor/hooks" &&
      profiles.cursor.projection.outputPaths.hooksFile === ".cursor/hooks.json",
    "Cursor runtime profile must declare hook output paths.",
  );
  assert(
    (manifest.generatedTargets?.cursor ?? []).includes(".cursor/hooks") &&
      (manifest.generatedTargets?.cursor ?? []).includes(".cursor/hooks.json"),
    "config/sync.json must advertise generated Cursor lifecycle hook paths.",
  );
}


async function validateSkillsManifest() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(repoRoot, "config", "skills.json"), "utf8"),
  );
  const hookprompt = manifest.skills?.find((skill) => skill.id === "hookprompt");
  assert(hookprompt, "config/skills.json must declare hookprompt.");
  assert(
    hookprompt.capabilities?.includes("prompt-submission-optimization"),
    "hookprompt must declare prompt-submission-optimization capability.",
  );
  assert(
    hookprompt.targets?.includes("claude") &&
      hookprompt.targets?.includes("codex") &&
      hookprompt.targets?.includes("cursor"),
    "hookprompt targets must install native Claude support plus Codex and Cursor adapter support.",
  );
  assert(
    hookprompt.platformSupport?.claude?.status === "native" &&
      hookprompt.platformSupport?.codex?.status === "adapter-required" &&
      hookprompt.platformSupport?.cursor?.status === "adapter-required",
    "hookprompt platformSupport must distinguish native, adapter-required, and degraded runtimes.",
  );

  const planning = manifest.skills?.find(
    (skill) => skill.id === "planning-with-files",
  );
  assert(
    planning?.hookSubdirs?.cursor && planning?.hookConfigFiles?.cursor,
    "planning-with-files must install Cursor lifecycle hooks.",
  );
}

async function validatePackageJson() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  assert(pkg.scripts?.["meta:sync"], "package.json is missing meta:sync.");
  assert(
    pkg.scripts?.["meta:validate"],
    "package.json is missing meta:validate.",
  );
  assert(
    pkg.scripts?.["meta:validate:run"],
    "package.json is missing meta:validate:run.",
  );
  assert(
    pkg.scripts?.["meta:eval:agents"],
    "package.json is missing meta:eval:agents.",
  );
  assert(
    pkg.scripts?.["meta:verify:all"],
    "package.json is missing meta:verify:all.",
  );
  assert(
    !pkg.scripts?.["sync:global:meta-theory:codex-active"],
    "package.json should not keep the legacy sync:global:meta-theory:codex-active script.",
  );
  assert(
    pkg.scripts?.["prepare:openclaw-local"],
    "package.json is missing prepare:openclaw-local.",
  );
  assert(
    pkg.scripts?.["meta:deps:install"] ===
      "node scripts/install-global-skills-all-runtimes.mjs --targets claude",
    "package.json meta:deps:install must use the Node-based installer with --targets claude.",
  );
  assert(
    pkg.scripts?.["meta:deps:update"] ===
      "node scripts/install-global-skills-all-runtimes.mjs --update --targets claude",
    "package.json meta:deps:update must use the Node-based installer with --targets claude.",
  );
  const setupTestScript = pkg.scripts?.["meta:test:setup"] ?? "";
  assert(
    /tests\/setup\/\*\.test\.mjs/.test(setupTestScript) &&
      (/node --test/.test(setupTestScript) ||
        /scripts\/run-node-tests\.mjs/.test(setupTestScript)),
    "package.json must expose meta:test:setup for installer regression coverage.",
  );
  assert(
    pkg.scripts?.["meta:verify:all"]?.includes("npm run meta:test:setup"),
    "package.json meta:verify:all must include npm run meta:test:setup.",
  );
  assert(
    pkg.scripts?.["meta:verify:all"]?.includes("npm run discover:global") &&
      pkg.scripts["meta:verify:all"].indexOf("npm run discover:global") <
        pkg.scripts["meta:verify:all"].indexOf("npm run meta:check"),
    "package.json meta:verify:all must run npm run discover:global before npm run meta:check.",
  );
  assert(
    pkg.scripts?.["meta:verify:all"]?.includes("npm run meta:graphify:check"),
    "package.json meta:verify:all must include npm run meta:graphify:check.",
  );
  assert(
    pkg.scripts?.["meta:verify:all:live"]?.includes("npm run meta:test:setup"),
    "package.json meta:verify:all:live must include npm run meta:test:setup.",
  );
  assert(
    pkg.scripts?.["meta:verify:all:live"]?.includes("npm run discover:global") &&
      pkg.scripts["meta:verify:all:live"].indexOf("npm run discover:global") <
        pkg.scripts["meta:verify:all:live"].indexOf("npm run meta:check"),
    "package.json meta:verify:all:live must run npm run discover:global before npm run meta:check.",
  );
  assert(
    pkg.scripts?.["meta:verify:all:live"]?.includes(
      "npm run meta:graphify:check",
    ),
    "package.json meta:verify:all:live must include npm run meta:graphify:check.",
  );
  assert(
    pkg.dependencies?.["@modelcontextprotocol/sdk"],
    "package.json is missing @modelcontextprotocol/sdk.",
  );
  assert(pkg.dependencies?.zod, "package.json is missing zod.");
  assert(pkg.license === "MIT", "package.json license must be MIT.");
}

async function validateGitignore() {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  const gitignore = await fs.readFile(gitignorePath, "utf8");
  for (const expected of [
    "node_modules/",
    "docs/",
    "openclaw/workspaces/*/.openclaw/",
    ".meta-kim/state/",
    ".meta-kim/local.overrides.json",
  ]) {
    assert(gitignore.includes(expected), `.gitignore is missing ${expected}`);
  }
}

function collectClaudeHookCommands(hooksRoot) {
  const commands = [];
  if (!hooksRoot || typeof hooksRoot !== "object") {
    return commands;
  }
  for (const entries of Object.values(hooksRoot)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (hook?.type === "command" && typeof hook.command === "string") {
          commands.push(hook.command.trim());
        }
      }
    }
  }
  return commands;
}


async function validateMcpConfig() {
  const config = JSON.parse(await fs.readFile(canonicalClaudeMcpPath, "utf8"));
  const server = config.mcpServers?.["meta-kim-runtime"];
  assert(
    server,
    "canonical/runtime-assets/claude/mcp.json is missing meta-kim-runtime.",
  );
  assert(server.command === "node", "meta-kim-runtime must run through node.");
  assert(
    server.args?.includes("__REPO_ROOT__/scripts/mcp/meta-runtime-server.mjs"),
    "canonical/runtime-assets/claude/mcp.json must use the __REPO_ROOT__ MCP template path.",
  );

  for (const relativePath of [".mcp.json", ".cursor/mcp.json"]) {
    const runtimeMcpPath = path.join(repoRoot, relativePath);
    if (!(await exists(runtimeMcpPath))) continue;
    const runtimeConfig = JSON.parse(await fs.readFile(runtimeMcpPath, "utf8"));
    const runtimeServer = runtimeConfig.mcpServers?.["meta-kim-runtime"];
    if (!runtimeServer) continue;
    const runtimeArg = runtimeServer.args?.[0] ?? "";
    assert(
      !runtimeArg.includes("__REPO_ROOT__") &&
        !runtimeArg.includes("REPLACE_WITH_REPO_ROOT"),
      `${relativePath} must not contain an unresolved MCP path placeholder.`,
    );
    assert(
      path.isAbsolute(runtimeArg),
      `${relativePath} meta-kim-runtime must use an absolute script path.`,
    );
    assert(
      await exists(runtimeArg),
      `${relativePath} meta-kim-runtime script path does not exist: ${runtimeArg}. meta-kim-runtime is only useful inside the Meta_Kim source repo. If this config was copied into another project, remove the meta-kim-runtime block; meta agents still load from .claude/.codex/.cursor/openclaw files.`,
    );
  }
}


function step(num, total, label, detail = "") {
  console.log(`\n[${num}/${total}] ${label}`);
  if (detail) console.log(`${detail}`);
}

function pass(msg = "") {
  console.log(`✓ ${msg}`);
}

function fail(msg) {
  console.error(`✗ ${msg}`);
}

/**
 * EB-004 deprecation check (v2.3.1, warn-only).
 *
 * Scans .meta-kim/state/<profile>/spine/spine-state.json files for
 * `preDecisionOptionFrame.{choiceSurfaceState,solutionChoiceState,choiceGateSkip}`
 * — these fields belong on the top-level `state` object, not nested inside
 * `preDecisionOptionFrame`. The frame describes the question; user answers
 * and state markers live at the top level.
 *
 * v2.3.1 emits warnings only. v2.4.0 will fail validation when legacy nesting
 * is found. A helper script `scripts/migrate-spine-state-eb004.mjs` promotes
 * the fields and removes the legacy nesting.
 *
 * @returns {Promise<{warnings: string[]}>}
 */
async function validateSpineStateChoiceFieldLocations() {
  const warnings = [];
  const stateDir = path.join(repoRoot, ".meta-kim", "state");
  if (!(await exists(stateDir))) {
    return { warnings };
  }

  let profiles;
  try {
    profiles = await fs.readdir(stateDir);
  } catch {
    return { warnings };
  }

  const legacyFields = [
    "choiceSurfaceState",
    "solutionChoiceState",
    "choiceGateSkip",
  ];

  for (const profile of profiles) {
    const stateFile = path.join(stateDir, profile, "spine", "spine-state.json");
    if (!(await exists(stateFile))) continue;
    let state;
    try {
      state = JSON.parse(await fs.readFile(stateFile, "utf8"));
    } catch {
      continue;
    }
    const frame = state?.preDecisionOptionFrame;
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) continue;
    for (const legacyField of legacyFields) {
      if (frame[legacyField] !== undefined) {
        warnings.push(
          `[EB-004 deprecation, v2.3.1 warn-only] '${toRepoRelative(stateFile)}': ` +
            `preDecisionOptionFrame.${legacyField} should be moved to state.${legacyField} ` +
            `(top-level). Will FAIL in v2.4.0. ` +
            `See docs/v2.3.1-rfc-EB-004-preDecisionOptionFrame-nesting.md. ` +
            `Helper: scripts/migrate-spine-state-eb004.mjs.`,
        );
      }
    }
  }

  return { warnings };
}

async function main() {
  const TOTAL = 11;
  let current = 1;

  console.log("\n========================================");
  console.log(t.val.headerTitle);
  console.log("========================================");

  // 1. Required files
  step(current++, TOTAL, t.val.step01, t.val.step01Detail);
  await validateRequiredFiles();
  pass(t.val.step01Pass);

  // 2. Workflow contract
  step(current++, TOTAL, t.val.step02, t.val.step02Detail);
  await validateWorkflowContract();
  pass(t.val.step02Pass);

  // 3. Sync manifest and runtime target catalog
  step(current++, TOTAL, t.val.step03, t.val.step03Detail);
  await validateSyncConfiguration();
  pass(t.val.step03Pass);

  // 4. Canonical agent definitions
  step(current++, TOTAL, t.val.step04, t.val.step04Detail);
  const agentIds = await validateClaudeAgents();
  pass(t.val.step04Pass(agentIds.length, agentIds));

  // 5. Canonical meta-theory skill
  step(current++, TOTAL, t.val.step05, t.val.step05Detail);
  await validatePortableSkill();
  pass(t.val.step05Pass);

  // 6. Skills manifest
  step(current++, TOTAL, t.val.step06, t.val.step06Detail);
  await validateSkillsManifest();
  pass(t.val.step06Pass);

  // 7. Canonical capability index
  step(current++, TOTAL, t.val.step07, t.val.step07Detail);
  await validateCapabilityIndex();
  pass(t.val.step07Pass);

  // 8. Documentation fact checks
  step(current++, TOTAL, t.val.step08, t.val.step08Detail);
  await validateDocumentationFacts();
  pass(t.val.step08Pass);

  // 9. npm scripts
  step(current++, TOTAL, t.val.step09, t.val.step09Detail);
  await validatePackageJson();
  pass(t.val.step09Pass);

  // 10. .gitignore
  step(current++, TOTAL, t.val.step10, t.val.step10Detail);
  await validateGitignore();
  pass(t.val.step10Pass);

  // 11. Canonical MCP config
  step(current++, TOTAL, t.val.step11, t.val.step11Detail);
  await validateMcpConfig();
  pass(t.val.step11Pass);

  // EB-004 deprecation check (warn-only, does not gate validation).
  const eb004Result = await validateSpineStateChoiceFieldLocations();

  console.log("\n========================================");
  console.log(t.val.footerAll(TOTAL));
  console.log(t.val.footerAgents(agentIds.length));
  if (eb004Result.warnings.length > 0) {
    console.log("----------------------------------------");
    console.log(
      `EB-004 deprecation warnings (v2.3.1 warn-only, will FAIL in v2.4.0):`,
    );
    for (const warning of eb004Result.warnings) {
      console.log(`  ! ${warning}`);
    }
  }
  console.log("========================================\n");
}

try {
  await main();
} catch (error) {
  console.error("\n    " + t.val.valFailed);
  console.error(`    ${error.message}\n`);
  process.exitCode = 1;
}
