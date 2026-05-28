#!/usr/bin/env node
import { classifyTaskShape, readJson, scoreRoute, supportScore } from "./governance-lib.mjs";

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const task = argValue("--task", "");
const runtime = argValue("--runtime", "auto");
const osTarget = argValue("--os", "auto");
const json = process.argv.includes("--json");
const taskShape = classifyTaskShape(task);
const taskText = String(task ?? "").toLowerCase();

const weapons = (await readJson("config/capability-index/weapon-registry.json")).weapons;
const dependencies = (await readJson("config/capability-index/dependency-project-registry.json")).projects;

function fitsTask(entry) {
  const haystack = JSON.stringify([entry.taskShapes, entry.triggerConditions, entry.name, entry.description]).toLowerCase();
  if (taskShape === "fuzzy_complex_task") return true;
  if (haystack.includes(taskShape.split("_")[0])) return true;
  if (/strategy|product|moneti|策略|产品|商业化|变现|定价|增长|转化/.test(taskText) && haystack.includes("decision")) return true;
  return false;
}

const candidateWeapons = weapons.filter(fitsTask);
const candidateDependencies = dependencies.filter((dep) => {
  const text = JSON.stringify(dep.capabilityCard).toLowerCase();
  if (/strategy|product|moneti|fuzzy|decision|策略|产品|商业化|变现|定价|增长|转化/.test(taskText)) return text.includes("orchestration") || text.includes("runtime") || text.includes("agent");
  if (/code|refactor|bug|test|代码|重构|缺陷|测试/.test(taskText)) return !dep.capabilityCard?.notFor?.includes("direct code execution");
  return true;
});

const routes = candidateWeapons.map((weapon) => {
  const dependencyIds = weapon.dependencyProjects ?? [];
  const dep = dependencyIds.length
    ? candidateDependencies.find((candidate) => dependencyIds.includes(candidate.id)) ?? null
    : null;
  const selectedRuntime = runtime === "auto" ? "codex" : runtime;
  const selectedOs = osTarget === "auto" ? "windows" : osTarget;
  const runtimeSupport = supportScore(weapon.runtimeSupport?.[selectedRuntime] ?? "unknown");
  const osSupport = supportScore(weapon.osSupport?.[selectedOs] ?? "unknown");
  const dependencyFit = dep ? dep.scoring?.overall ?? 70 : weapon.type === "dependency_project" ? 50 : 70;
  const strategyDecisionTask = taskShape === "strategy_product_decision" || /strategy|product|moneti|策略|产品|商业化|变现|定价|增长|转化/.test(taskText);
  const intentFit = strategyDecisionTask && weapon.id === "meta-kim-decision-patterns"
    ? 100
    : strategyDecisionTask && weapon.id === "dependency-project-registry"
      ? 80
      : fitsTask(weapon) ? 85 : 50;
  const routeScore = scoreRoute({
    intentFit,
    ownerFit: weapon.ownerCandidates?.length ? 85 : 0,
    weaponFit: 90,
    dependencyFit,
    runtimeSupport,
    osSupport,
    verification: weapon.verification?.command ? 85 : 20,
    riskClarity: weapon.risk ? 80 : 20,
  });
  return {
    id: `${weapon.id}:${selectedRuntime}:${selectedOs}`,
    owner: weapon.ownerCandidates?.[0] ?? null,
    weapon: weapon.id,
    dependencyProject: dep?.id ?? null,
    runtime: selectedRuntime,
    os: selectedOs,
    verificationOwner: "meta-prism",
    verification: weapon.verification,
    score: routeScore,
    scoreBand: routeScore >= 85 ? "execute" : routeScore >= 70 ? "confirm_or_fetch" : routeScore >= 50 ? "upgrade_needed" : "blocked",
  };
}).sort((a, b) => b.score - a.score);

const recommendedRoute = routes[0] ?? null;
const capabilityGapPacket = recommendedRoute && recommendedRoute.score >= 50 ? null : {
  gap: "No route has enough owner+weapon+dependency+runtime+os+verification support.",
  taskShape,
  missing: ["owner_weapon_dependency_route"],
};

const output = {
  taskShape,
  intentAmplificationPrecheck: {
    needsIntentAmplification: taskShape === "fuzzy_complex_task" || /fuzzy|strategy|product|moneti|complex|模糊|复杂|策略|产品|商业化|变现|定价|增长|转化/.test(taskText),
    reason: "Route may change based on real intent and success criteria."
  },
  candidateOwners: [...new Set(candidateWeapons.flatMap((weapon) => weapon.ownerCandidates ?? []))],
  candidateWeapons: candidateWeapons.map((weapon) => weapon.id),
  candidateDependencyProjects: candidateDependencies.map((dep) => dep.id),
  internalDecisionPatterns: candidateWeapons.some((weapon) => weapon.id === "meta-kim-decision-patterns")
    ? ["critical-real-intent-lock", "fetch-evidence-labeling", "thinking-subject-path-map", "thinking-minimum-test", "review-pass-kill-gate"]
    : [],
  runtimeFilterResult: { requested: runtime, applied: runtime === "auto" ? "codex" : runtime },
  osFilterResult: { requested: osTarget, applied: osTarget === "auto" ? "windows" : osTarget },
  rankedRoutes: routes,
  recommendedRoute,
  userChoiceNeeded: !recommendedRoute || recommendedRoute.score < 85,
  decisionCard: recommendedRoute && recommendedRoute.score < 85 ? {
    recommendedDefault: recommendedRoute.id,
    reason: "Route is useful but needs confirmation or more evidence.",
    options: routes.slice(0, 3).map((route) => ({
      id: route.id,
      bestFor: route.scoreBand,
      benefit: "Uses discovered owner + weapon + verification.",
      cost: "May need more evidence if score < 85.",
      risk: "Capability support may be partial.",
      expectedResult: "Bounded execution route.",
      verification: route.verification?.command ?? "manual review"
    }))
  } : null,
  capabilityGapPacket,
  verificationPlan: {
    command: "npm run meta:route:validate",
    owner: "meta-prism",
    doneCondition: "recommendedRoute has owner, weapon, runtime, OS, verification owner, and score >= 70 or capabilityGapPacket exists."
  }
};

if (json) console.log(JSON.stringify(output, null, 2));
else console.log(JSON.stringify(output, null, 2));
