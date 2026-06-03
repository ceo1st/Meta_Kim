# Meta_Kim Governance Agent Benchmark Review

## 文档控制

- 版本：v0.1
- 状态：Draft for review
- Owner：meta-warden 负责最终判断，meta-prism 负责质量审计，meta-genesis / meta-artisan 负责 agent 生成能力审计
- 范围：只读审计治理层 9 个 meta agent；不修改 agent 设定，不提交，不推送
- 审计脊柱：Critical / Fetch / Thinking / Review

## Executive Summary

Meta_Kim 的治理层 agent 目前强在边界、防污染和跨阶段门禁；弱点不在“没有足够多 agent”，而在缺少一套对外可复现的 benchmark，证明它们能稳定造出 GitHub 顶级水平的执行 agent。

## Critical：真正要判断什么

这次审计不问“9 个治理 agent 写得像不像高级 prompt”。真正的问题是：

1. 它们迭代或更新时，能不能造出边界清楚、可调用、可验证、可安装、可复用的执行 agent？
2. 它们会不会把一次性任务、具体路径、今天要改的文件、临时验证步骤写进长期 agent identity？
3. 它们和 GitHub 上成熟 agent 生态相比，差的是能力、结构、评测，还是产品化入口？

判断标准：

- 好 agent 不是“什么都懂”，而是清楚知道自己做什么、不做什么、需要哪些工具、产出什么、怎么验收。
- 好治理层不是“自己上手干”，而是能把缺口路由成合适的 skill、agent、script、MCP-provider、workerTask-only 或 blocked。
- 好迭代不是越写越复杂，而是让下一次 agent 生成更稳定、更短、更可复用。

## Fetch：本地证据

本地治理层共有 9 个 canonical meta agent：

| Agent | 当前主责 | 初步判断 |
|---|---|---|
| `meta-warden` | 入口、门禁、仲裁、最终综合 | 治理边界强，但需要更直接的 agent 成品验收表 |
| `meta-conductor` | Critical/Fetch/Thinking 编排、dispatch board、业务流 | 编排能力强，文件最长，容易把 planner 与协议细节压到 agent 里 |
| `meta-genesis` | SOUL / agent identity 设计 | 最接近“造 agent”的核心 owner，已有 A/D 示例和 8 模块要求 |
| `meta-artisan` | skill / tool / MCP / command loadout | provider-first 思路强，是让 agent 可执行的关键 |
| `meta-prism` | 质量审计、AI slop、上游链路检查 | 能拒绝烂产物，但需要专门的 generated-agent benchmark |
| `meta-scout` | 外部能力发现、当前事实、生态扫描 | 适合把 GitHub 标杆变成候选，但不能替代采纳决策 |
| `meta-sentinel` | 安全、hook、权限、rollback | 权限边界强，适合 agent 工具最小权限审计 |
| `meta-librarian` | memory、连续性、上下文策略 | 对长期 agent 记忆策略有价值，但不该决定 agent identity |
| `meta-chrysalis` | evolution signal、writeback 候选、重复模式 | 适合记录“重复 3 次再升级”，但不能直接改 canonical |

本地强证据：

- 每个 meta agent 都有 frontmatter 的 `own`、`do_not_touch`、`boundary`、`trigger`。
- 每个 meta agent 都声明 governance layer，不是 direct execution worker。
- `meta-genesis` 明确 SOUL 设计、反 AI-slop、A/D 示例、替换性测试。
- `meta-artisan` 明确抽象能力槽、provider-first、技能/工具/MCP/command 发现。
- `workflow-contract.json` 已经把 `executionAgentCard` 与 `workerTaskPacket` 分开，禁止把具体工作单写进长期 identity。

本地薄弱证据：

- 没有一个专门的“generated execution agent benchmark”来证明 Genesis + Artisan + Prism + Warden 的闭环质量。
- 9 个 meta agent 文件都较长，其中 `meta-conductor` 超过 60KB，`meta-warden` 超过 40KB，容易让实现者读成协议百科，而不是可操作 owner。
- 已有 pass/fail criteria，但多是治理运行 pass/fail；缺少“造出的 agent 是不是一流”的样例评分。
- 缺少与 GitHub-style agent spec 的外显对齐表，例如 description 长度、工具最小权限、handoff、user-invocable、安装/投影兼容。

## Fetch：GitHub 标杆

本轮只选对 Meta_Kim 有直接参考价值的公开来源：

1. GitHub `awesome-copilot`
   - 强项：社区集合、agents / instructions / skills / hooks / workflows / plugins 分层清楚。
   - 参考点：有 machine-readable `llms.txt`，对 AI agent 友好；有搜索、筛选和安装入口。

2. GitHub `agents.instructions.md`
   - 强项：把 custom agent 写成可维护规范：YAML frontmatter、简洁 description、tools、model、target、user-invocable、handoffs。
   - 参考点：强调工具最小权限、明确 handoff、prompt 结构、变量传递、sub-agent wrapper prompt、不要把编排代码塞进 prompt。

3. VoltAgent `awesome-claude-code-subagents`
   - 强项：100+ 专门 subagents、分类、插件安装、交互安装、meta-orchestration 类目。
   - 参考点：agent-organizer、context-manager、workflow-orchestrator 等不是一个巨型 meta agent，而是可选的轻量专业角色。

4. wshobson `agents`
   - 强项：multi-harness agent/plugin marketplace，覆盖 Claude Code、Codex、Cursor、OpenCode、Gemini、Copilot。
   - 参考点：源树到多 runtime 投影、结构化 validate、drift/dead-link/cap 检查，以及三层质量评测。

5. Awesome Copilot Agents/Subagents learning hub
   - 强项：解释什么时候需要 subagent，什么时候不需要。
   - 参考点：subagent 用于独立研究、并行 review、拆分依赖、减少上下文压力；小任务不需要 subagent。

## 外部标杆样本：wshobson/agents 的 `python-pro`

如果只选一个“全网公认度较高、能看出好 agent 结构”的参考，本轮建议看 `wshobson/agents` 体系里的 `python-pro`。

选择理由：

- `wshobson/agents` 是高星标、多 harness、可安装的 agentic plugin marketplace。
- 它不是只有一个 prompt，而是有 agents、skills、commands、orchestrators、插件、跨 harness 生成、结构校验和质量评测。
- `python-pro` 是典型 domain expert agent：不是“帮我写某个 Python 文件”，而是“现代 Python 专家”。

### 它的设定骨架

| 层 | 内容 | 为什么重要 |
|---|---|---|
| `name` | `python-pro` | 短、稳定、可调用，不绑定具体任务 |
| `description` | Python 3.12+、async、性能、生产实践、uv/ruff/pydantic/FastAPI | 一句话完成触发条件 + 专业范围 |
| `model` | `opus` | 用强模型处理复杂专业判断 |
| Identity | 现代 Python 3.12+ 专家 | 抽象到领域，不抽象到“优秀工程师” |
| Purpose | 掌握现代 Python、工具链、生产级实践 | 说明为什么存在 |
| Capabilities | 语言特性、现代工具、测试、性能、Web/API、数据/ML、DevOps、模式 | 专业面明确，但仍是能力类别 |
| Behavioral Traits | 可读性、类型提示、测试覆盖、标准库优先、安全、文档 | 把“怎么做事”写成行为约束 |
| Knowledge Base | Python 生态、异步、部署、安全、性能、测试 | 告诉 agent 知识边界 |
| Response Approach | 分析需求、推荐现代工具、给生产代码、补测试、考虑性能与安全 | 把输出流程固化 |
| Example Interactions | uv 迁移、async 优化、FastAPI 设计、Dockerfile 等 | 让触发场景可理解 |

### 为什么它算“抽象但专业”

它没有说：

- “修改这个仓库里的某个文件”
- “今天完成某个 PR”
- “永远使用某个具体路径”

它说的是：

- 现代 Python 专业领域
- 生产级实践
- 具体生态工具
- 测试、性能、安全、部署这些专业判断维度

这就是 Meta_Kim 要学习的中间态：不是“万能工程师”，也不是“一次性任务执行器”。

### 它不完美的地方

从 Meta_Kim 的标准看，它也有不足：

- `description` 很长，触发条件容易过宽。
- 工具权限在 raw agent 文件里不明显，需要依赖 plugin/harness 层。
- 没有显式 `do_not_touch`，拒绝边界不如 Meta_Kim 硬。
- Capabilities 列得很满，容易接近“Python 全能专家”，需要靠 orchestrator 或 plugin scope 控制。

所以它是很好的“专业 agent 样本”，但不是 Meta_Kim 应该原样照抄的终点。

### Meta_Kim 应该吸收什么

| 应吸收 | 不应照抄 |
|---|---|
| 短 name + 高信号 description | 超长 description |
| 领域能力，而不是一次性任务 | 把所有能力都塞进一个 agent |
| 专业生态工具名，例如 uv/ruff/pydantic | 把工具名写死成长期唯一依赖 |
| Response Approach | 没有拒绝边界 |
| Example Interactions | 没有 fixture 验收 |
| 跨 harness 投影与质量评测 | 只靠 prompt 文本判断质量 |

### 对 Meta_Kim 的直接判断

如果 Meta_Kim 造出一个 `python-pro` 同级别 agent，它应该比这个样本更强，因为它需要额外具备：

- `do_not_touch`
- `workerTask` 分离
- `CandidateWriteback`
- `verificationOwner`
- `tool least privilege`
- `fixture pass`

也就是说，目标不是“复制 wshobson 的 agent”，而是生成一个 **GitHub-style 专业 agent + Meta_Kim 治理边界** 的版本。

## 补充标杆：gstack / gbrain

用户点名后，本轮用 GitHub CLI 搜索确认了当前公开热度：

- `garrytan/gstack`：约 106k stars，定位是 Garry Tan 的 Claude Code setup，强调 23 个 opinionated tools，服务为 CEO、Designer、Eng Manager、Release Manager、Doc Engineer、QA 等角色。
- `garrytan/gbrain`：约 20.7k stars，定位是 agent brain，强调 synthesis、graph traversal、gap analysis、访问隔离、schema packs、evals。

这两个项目给 Meta_Kim 的启发和 `wshobson/agents` 不一样。`wshobson/agents` 展示“专业 agent 怎么写”；`gstack/gbrain` 展示“专业 agent 怎么变成产品质量”。

### gstack：不是 agent 列表，而是产品化流程

gstack README 里最重要的一句话不是“有很多工具”，而是它把开发过程组织成：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

它的强点：

| 设计 | 人话解释 | Meta_Kim 可吸收点 |
|---|---|---|
| 角色化技能 | CEO 质疑产品，Eng Manager 锁架构，QA 真浏览器测试，Release Engineer 负责 ship | agent 不只是“能力”，还要嵌入业务流程位置 |
| 技能前后喂资料 | `/office-hours` 写 design doc，后续 review/engineering/QA 读取 | Meta_Kim 的 workerTask / CandidateWriteback 应有产物链 |
| 触发和路由 | CLAUDE.md 里写 skill routing，产品想法走 office-hours，bug 走 investigate，QA 走 qa | Meta_Kim 需要自然 route，而不是靠用户记命令 |
| Preamble | 每个 skill 开头检查版本、配置、session、repo mode、learned state | Meta_Kim agent 运行前应有轻量环境感知 |
| 决策卡 | AskUserQuestion 变成带推荐、利弊、风险的人话 decision brief | Meta_Kim 的 Critical/Thinking 选择应更像产品决策卡 |
| adversarial review | review 里固定引入独立 adversarial subagent / Codex challenge | Prism 可以吸收“固定反方审计”作为 generated-agent 评测 |
| multi-host | 支持 Claude、Codex、OpenCode、Cursor、OpenClaw、GBrain 等 host | Meta_Kim 的 runtime projections 是对的，但要做出用户可感知的安装体验 |

gstack 对“优秀 agent”的启发：

- 好 agent 不是孤立人格，而是流程里的一个岗位。
- 好 agent 的价值来自和上下游的交接，不只是自己的 prompt。
- 好 agent 要知道什么时候问用户，问的问题必须有推荐、代价和风险。
- 好 agent 要保留运行记录、学习记录、review 记录，让下一步能用。

gstack 不该照搬的部分：

- skill 文件里大量 bash/preamble 逻辑很强，但也很重；Meta_Kim 不应把所有 runtime 细节塞进 agent identity。
- 自动写 CLAUDE.md、自动 commit、team mode 等动作要严格经过用户授权；Meta_Kim 的外部写动作边界必须更硬。
- gstack 偏“强流程产品”，Meta_Kim 偏“跨 runtime 治理层”；不能把 gstack 的 sprint 命令表直接变成 Meta_Kim 的治理源。

### gbrain：agent 质量的记忆层

gbrain README 的核心不是“搜索”，而是“给 agent 一个不会失忆、能综合、能发现缺口的 brain”。

它的强点：

| 设计 | 人话解释 | Meta_Kim 可吸收点 |
|---|---|---|
| synthesis layer | 不只是返回命中的 chunks，而是综合成答案并带引用 | Meta_Kim memory 不能只存日志，要能产出决策依据 |
| graph traversal | 人、公司、项目、事件之间有 typed edges | CapabilityGap / CandidateWriteback 后续可变成关系，不急着先做大图 |
| gap analysis | 明确说自己不知道什么 | Meta_Kim 缺能力时应自然生成 gap decision |
| scoped access | 团队每个人只能看自己有权限的 brain slice | Meta_Kim 的 memory/agent 输出必须带访问边界 |
| schema packs | 不固定一种知识结构，可检测/建议/应用 schema | Meta_Kim 可以用 capability packs，而不是一个固定 CapabilityGraph |
| evals | 有 BrainBench / gbrain-evals | Meta_Kim 要用 benchmark 证明 agent 生成质量 |
| skillopt | 把 `SKILL.md` 当可训练参数，用 benchmark 提升 | Meta_Kim 的 agent 迭代也应“有分数才改”，不是凭感觉改 prompt |

gbrain 对“优秀 agent”的启发：

- 没有记忆层，agent 专业能力会随上下文断掉。
- 没有 gap analysis，agent 会假装知道。
- 没有 access scope，团队脑会泄漏。
- 没有 evals，迭代只是改文案。

gbrain 不该照搬的部分：

- Meta_Kim 不应马上做完整知识图或图数据库。
- gbrain 是 memory/brain 产品，Meta_Kim 是治理投影系统；应吸收 schema pack、gap analysis、evals、access scope，而不是复制数据模型。
- gbrain 的强记忆层应作为 capability provider，而不是让每个 agent 自己背长期记忆。

## 吸收后的优秀 agent 标准 v2

结合 `wshobson/agents`、`gstack`、`gbrain` 后，优秀 agent 的标准升级为：

| 标准 | 说明 |
|---|---|
| 1. 抽象但专业 | 描述稳定领域能力，不绑定一次性任务；但有真实技术栈、判断维度和专业词汇 |
| 2. 流程位置清楚 | 知道自己在 Think/Plan/Build/Review/Test/Ship/Reflect 哪一段 |
| 3. 上下游交接清楚 | 产物能被下一个 skill/agent 读取，不靠口头总结 |
| 4. 专业 loadout 清楚 | skill / command / MCP / tool 不是装饰，而是和能力槽匹配 |
| 5. Memory 不失忆 | 读取相关历史、学习、用户纠正；但长期记忆有作用域和权限 |
| 6. Gap 会承认 | 不知道、不够用、没授权时能生成 gap decision，不硬做 |
| 7. 决策会问人 | 需要用户判断时给推荐、代价、风险，不抛选择题垃圾 |
| 8. 可安装可投影 | 能进入不同 runtime，不只是某个 chat 的 prompt |
| 9. 可评测可优化 | 有 fixtures/evals/scorecard，迭代必须分数变好 |
| 10. 边界比能力更硬 | 外部写、权限、长期 writeback、身份污染都必须可拒绝 |

### 对 Meta_Kim 的新判断

Meta_Kim 现有治理层最像 `gbrain + gstack` 的混合雏形：

- 像 gstack：有 Critical/Fetch/Thinking/Review、有 workflow、有角色、有验证。
- 像 gbrain：有 memory、capability gap、writeback、schema/contract 想法。

但 Meta_Kim 当前还缺三个产品化证明：

1. **Generated-agent fixture**：证明能造出一个抽象但专业的 agent。
2. **Agent product flow**：证明这个 agent 能嵌入 Think/Plan/Build/Review/Test/Ship 的某个位置。
3. **Agent eval loop**：证明这个 agent 经过 review/eval/feedback 后真的变好。

所以下一步不是再写治理原则，而是做一个最小演示：

```text
输入：需要 test-coverage-specialist
Meta_Kim 输出：
1. CapabilityGap
2. GapDecision = create_agent
3. GitHub-style GeneratedAgentSpec
4. gstack-style flow position
5. gbrain-style memory/gap/eval policy
6. Prism scorecard
7. Warden gate
```

如果这个演示能跑通，Meta_Kim 才能说自己不是“治理漂亮”，而是真的能造产品级 agent。

## Thinking：对标后的 10 条好 agent 标准

| 标准 | GitHub 标杆表现 | Meta_Kim 当前状态 | 差距 |
|---|---|---|---|
| 1. 单一责任 | 专门 agent 按任务族拆分 | meta agent 主责明确 | 基本达标 |
| 2. 简短可读 description | 50-150 字符、可行动 | frontmatter 有 description，但正文太长 | 需要外显短规格 |
| 3. 工具最小权限 | tools 显式声明，少即清楚 | meta agent 普遍 tools 很宽 | 需要生成 agent 的工具审计 |
| 4. 不该做什么 | 有边界/限制 | `do_not_touch` 很强 | 强于多数标杆 |
| 5. 可安装/可投影 | 插件、目录、安装脚本、多 harness | Meta_Kim 有 runtime projection | 需要 agent 成品级安装证明 |
| 6. Handoff / orchestration | handoff、allowlist、wrapper prompt | Meta_Kim 有 dispatchBoard/workerTask | 需要转成人话 workflow 示例 |
| 7. 验收样例 | 部分有 examples / evaluation | meta-prism 有审计，但缺 generated-agent fixture | 主要差距 |
| 8. 目录化发现 | 分类、搜索、llms.txt | 有 capability-index | 需要更面向外部用户的 agent catalog |
| 9. 质量评测 | structural + LLM judge + Monte Carlo 思路 | 有 validators 和 tests | 需要 agent quality scorecard |
| 10. 小任务不滥用 subagent | 明确小任务可不代理 | Meta_Kim 理论上支持 workerTask-only | 需要 fixture 证明默认路径会这么做 |

## 核心追问：能不能设计“抽象但专业”的 agent

结论：**有这个能力的结构基础，但还没有足够实证证明。**

更直白一点：

- Meta_Kim 现在已经知道什么叫“抽象但不空”：`meta-genesis` 要求 Core Truths 换个 agent 名还成立就判 D 级，这能防止泛泛而谈。
- Meta_Kim 也知道什么叫“专业但不绑定一次性任务”：`workflow-contract.json` 要求 `executionAgentCard` 描述 reusable capability class，具体文件、今天任务、verifySteps 必须放进 `workerTaskPacket`。
- Meta_Kim 还知道专业能力不能只靠人设：`meta-artisan` 要给 skill / command / MCP / tool loadout 做 ROI 和平台兼容判断。
- 但它还没有跑过一组公开可复盘的 fixture，证明 Genesis + Artisan + Prism + Warden 能稳定地产出这种 agent。

### “抽象但专业”的定义

| 维度 | 抽象但专业 | 假抽象 | 假专业 |
|---|---|---|---|
| Identity | 描述稳定能力类别，例如 release quality reviewer | “追求卓越、认真分析” | “今天改 docs/foo.md” |
| Domain specificity | 换成别的 agent 名会失效 | 换任何 agent 名都成立 | 只列一堆具体工具名 |
| Decision rules | 有 if/then/else，覆盖边界和异常 | 只有原则口号 | 写成一次性 SOP |
| Loadout | 工具/skill/MCP 与能力槽匹配，有 ROI | 没有工具策略 | 工具堆满但不说明为什么 |
| Non-goals | 清楚拒绝不属于自己的任务 | 没拒绝项 | 拒绝项只是“不要做坏事” |
| Verification | 可用 fixture 或输出断言验收 | 只能主观判断 | 只验证某次任务完成 |
| Memory/writeback | 重复模式才进入长期能力 | 不记录复用信号 | 把历史任务写进身份 |

### 当前能力评分

| 能力 | 当前分 | 理由 |
|---|---:|---|
| 抽象边界设计 | 85/100 | Genesis 有 replaceability test、SOUL 8 模块、反具体任务规则 |
| 专业 loadout 设计 | 75/100 | Artisan 有 ROI、平台兼容、skill/MCP/tool loadout，但还没接入新 PRD 的 6 类 decision fixture |
| 假专业识别 | 80/100 | Prism 有 SLOP-06 replaceability、SLOP-09 具体任务 vs domain abstraction |
| 长期身份防污染 | 85/100 | contract 明确 `executionAgentCard` 与 `workerTaskPacket` 分离 |
| 生成结果可证明性 | 45/100 | 缺 generated-agent fixtures 和 scorecard，这是最大短板 |

综合判断：**理论能力 80 分，实证能力 45 分。**

这意味着：治理层的方向是对的，但产品质量不能靠“看起来很懂”来背书。最终产品质量要靠 generated-agent benchmark 证明。

### 最关键的风险

如果不补 benchmark，Meta_Kim 很容易出现两种失败：

1. 抽象过头：造出来的是“高级通用顾问”，看似可复用，实际没有专业判断。
2. 专业过头：造出来的是“某次任务执行说明书”，看似精准，实际污染长期 identity。

真正要证明的是中间地带：

```text
稳定领域能力 + 清晰拒绝边界 + 专业 loadout + 可验证输出 + 不绑定一次性任务
```

## 9 个治理 agent 的能力判断

### `meta-genesis`

结论：是造 agent 的核心，但现在更像“SOUL 架构师”，还不是完整 agent factory。

强项：

- 能定义长期 identity、Core Truths、Decision Rules、Thinking Framework。
- 有好/坏 SOUL 示例。
- 明确不能写一次性任务、具体路径、长期 concrete skill location。

缺口：

- 输出更偏 SOUL.md，不一定覆盖 GitHub-style agent 的 frontmatter、tools、handoffs、runtime target、安装路径。
- 需要一个 `GeneratedAgentSpec` 验收表：identity、tools、non-goals、handoff、verification、install projection。

### `meta-artisan`

结论：是 agent 能不能真用的关键。

强项：

- 负责 skill、tool、MCP、command/script、platform compatibility。
- 已有 ROI 和 provider-first 思路。

缺口：

- 对“create_skill / create_script / create_mcp_provider / workerTask-only”的分流还没有从 PRD 进入自己的输出标准。
- 需要把推荐结果压成短表：slot、候选、ROI、风险、验证命令、是否长期写回。

### `meta-conductor`

结论：编排能力强，但最容易过度工程化。

强项：

- Critical/Fetch/Thinking、dispatch board、business-flow、merge owner 都在这里。
- 能处理复杂任务的阶段和依赖。

缺口：

- 文件过长，容易让使用者照协议跑，而不是自然判断。
- 需要一个“简单任务不代理、一次性任务 workerTask-only、复杂任务才 DAG”的硬示例。

### `meta-warden`

结论：适合作最终门禁，但不能替代 agent factory 设计。

强项：

- 入口、仲裁、质量门禁、evolution gate 清楚。
- 对 public-ready、verification、writeback 有强控制。

缺口：

- 需要明确“造出的 execution agent 是否达 GitHub 顶级水平”的 gate，而不仅是流程 gate。

### `meta-prism`

结论：适合做 generated-agent 评审 owner。

强项：

- AI-slop、上游链路、verification evidence 审计很强。
- 能检查“看起来完成但实际没有”的情况。

缺口：

- 需要新增一套 agent 评测 lens：specificity、tool fit、boundary clarity、installability、fixture pass、identity cleanliness。

### `meta-sentinel`

结论：适合审工具权限和外部动作边界。

强项：

- 权限、hook、rollback、MCP permission auditing 都在边界内。

缺口：

- 需要针对 generated agent 的 least-privilege matrix：read/search/edit/execute/web/MCP/agent 哪些允许，为什么。

### `meta-scout`

结论：适合持续寻找 GitHub 标杆，但不该直接采纳外部 agent。

强项：

- 外部 evidence、工具/skill discovery、维护/安全初筛。

缺口：

- 需要把外部标杆转换成 reference pattern，而不是路径/仓库绑定。

### `meta-librarian`

结论：适合管 agent 的记忆与复用信号。

强项：

- memory shelf life、continuity、run-index。

缺口：

- 需要明确 agent 什么时候可以拥有 memory，什么时候只能 run-scoped，不然容易把历史任务塞进 identity。

### `meta-chrysalis`

结论：适合管重复 3 次以上的 evolution writeback。

强项：

- writeback gate、重复模式、scar、边界漂移。

缺口：

- 需要把新 PRD 的 CandidateWriteback 接进 evolution 候选，而不是直接写 agent。

## Review：现在是否合理

总体合理，但还没有证明“能造出顶级 agent”。

可以说已经合理的部分：

- 治理 agent 不直接执行，这一点很明确。
- owner / do_not_touch / boundary / trigger 基础结构完整。
- 长期 identity 与 run-scoped workerTask 的分离原则已经存在。
- Genesis / Artisan / Prism / Warden 的工厂链条雏形是对的。

不能说已经完成的部分：

- 没有 generated-agent benchmark。
- 没有 6 类 capability gap decision fixture 真正跑进 meta agent 输出。
- 没有外部标杆映射后的 agent quality scorecard。
- 没有示例证明它能生成一个 GitHub-style、可安装、可调用、可验收的执行 agent。

## 分工与 LangGraph 化结论

用户最新提醒是对的：Meta_Kim 要先分清谁负责什么，不能把 skill、治理 agent、执行 agent、script、MCP provider、workerTask 混成一类。

最清楚的分工是：

| 类型 | 负责 | 不负责 |
|---|---|---|
| 治理 agent | 判断、编排、审计、门禁、写回候选 | 不做具体实现 worker |
| 执行 agent | 长期专业岗位，例如 `test-coverage-specialist` | 不绑定本次文件和今天任务 |
| skill | 可复用方法包，例如 PRD review 标准 | 不拥有长期责任身份 |
| script | 稳定机械动作，例如 JSON 转换 | 不做专业判断 |
| MCP provider | 外部系统能力和权限边界 | 不绕过外部写授权 |
| workerTask | 本次 run 的具体工作单 | 不进入长期 identity |

如果形成 LangGraph，第一版不应该是“知识大图”，而应该是“控制图”：

```text
Critical
-> Fetch providers
-> Detect CapabilityGap
-> Decide GapDecision
-> branch:
   create_skill / create_agent / create_script / create_mcp_provider / worker_task_only / blocked
-> Prism Review
-> Warden Gate
-> Verification
-> Evolution
```

也就是说：

- `CapabilityGap` 是 state 里的问题记录。
- `GapDecision` 是 conditional edge 的路由结果。
- `GeneratedAgentSpec` 只在 create_agent 分支出现。
- `workerTaskPacket` 是 run-scoped task state，不是 agent identity。
- `CandidateWriteback` 是图末尾的 evolution state，不是自动写 canonical。
- validator / hook 是 fail-fast guard，不是 planner 节点。

这个分工已经单独整理到 `docs/meta-kim-capability-governance-langgraph-plan.zh-CN.md`。下一步本地测试时，应该先测这条控制图能不能把 6 类 gap 分对，而不是先测一张完整 CapabilityGraph。

## 建议的下一步

### Phase 1：建立 Agent Quality Scorecard

先不改 9 个 agent。先建立一张评分表：

- `identity_clarity`
- `boundary_clarity`
- `tool_least_privilege`
- `handoff_readiness`
- `verification_readiness`
- `install_projection_readiness`
- `runtime_projection_readiness`
- `workerTask_separation`
- `candidateWriteback_policy`
- `anti_slop_score`

### Phase 2：做 3 个 generated-agent fixtures

不用 30 个，先做 3 个：

1. `test-coverage-specialist`：应该 create_agent，带只读/测试工具边界。
2. `release-note-normalizer`：应该 create_script 或 create_skill，不该 create_agent。
3. `github-pr-publisher`：应该 blocked_or_needs_approval，外部写动作未授权不能执行。

### Phase 3：用 Genesis + Artisan + Prism + Warden 跑一次闭环

每个 fixture 要产出：

- `CapabilityGap`
- `GapDecision`
- `GeneratedAgentSpec` 或 non-agent decision
- `CandidateWriteback`
- `PrismReview`
- `WardenGate`

### Phase 4：再决定是否修改 canonical agents

只有当 fixture 暴露稳定缺口，才改：

- `meta-genesis`：补 generated agent spec 模板。
- `meta-artisan`：补 loadout scorecard。
- `meta-prism`：补 generated-agent review lens。
- `meta-warden`：补 final gate for generated agent quality。

## 一句话结论

Meta_Kim 的治理层已经有“防止造坏 agent”的骨架，但还缺“证明能造好 agent”的 benchmark。下一步不该继续堆治理文本，而该跑 3 个 generated-agent fixtures，让 Genesis / Artisan / Prism / Warden 用结果说话。

## Sources

- GitHub Awesome Copilot: https://github.com/github/awesome-copilot
- GitHub Awesome Copilot agent guidelines: https://github.com/github/awesome-copilot/blob/main/instructions/agents.instructions.md
- GitHub Docs custom agents: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents
- VoltAgent awesome Claude Code subagents: https://github.com/VoltAgent/awesome-claude-code-subagents
- VoltAgent meta-orchestration category: https://github.com/VoltAgent/awesome-claude-code-subagents/tree/main/categories/09-meta-orchestration
- wshobson multi-harness agents: https://github.com/wshobson/agents
- Awesome Copilot agents and subagents guide: https://awesome-copilot.github.com/learning-hub/agents-and-subagents/
- gstack: https://github.com/garrytan/gstack
- gbrain: https://github.com/garrytan/gbrain
- LangGraph: https://github.com/langchain-ai/langgraph
