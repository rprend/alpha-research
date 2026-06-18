# Benchmark Creator Literature Review

Last updated: 2026-06-18

## Purpose

This review maps existing benchmarks and benchmark-construction methods relevant to a benchmark creator whose goal is to discover, ground, and classify hard research-agent tasks. The intended benchmark is not just another QA set. It should evaluate whether agents can turn large, messy evidence spaces into correct, cited answers, and whether extra token spend or parallel agents solve tasks linearly, sublinearly, or not at all.

The main lesson from the literature is that the benchmark creator should treat these as separate design problems:

- Task generation: where candidate hard tasks come from.
- Truth construction: why the answer is correct.
- Difficulty measurement: why failure means meaningful difficulty rather than scale, ambiguity, leakage, or bad grading.
- Reproducibility: whether different systems can be compared under stable evidence and tool conditions.

## Closest Existing Benchmarks

| Benchmark | Problem space | Construction pattern | Ground truth | Relevance |
| --- | --- | --- | --- | --- |
| BrowseComp | Web-browsing agents finding hard-to-locate facts | Human-authored questions designed to require persistent browsing | Short reference answers | Closest to "deep research search" but static/web-exposed tasks can leak and saturate. |
| BrowseComp-Plus | Deep-research agents and retrieval methods | Attempts to make BrowseComp-style evaluation more transparent and fair | More controlled corpus/evaluation setup | Directly relevant to separating retrieval, citation, and context-engineering effects. |
| LoHoSearch | Long-horizon search agents | Automated question construction from a large Wikipedia knowledge graph, then human verification | KG-verified unique answers | Strong precedent for machine-assisted hard-task generation beyond human intuition. |
| EvoBrowseComp | Search agents on evolving knowledge | Dynamic/evolving search tasks | Time-sensitive evolving facts | Relevant to temporal benchmark refresh and contamination resistance. |
| GAIA | General AI assistants with tools | Human-authored real-world questions using reasoning, browsing, multimodality, and tool use | Hidden answers for leaderboard split | Good model for simple-for-humans, hard-for-agents tasks. |
| FRAMES | RAG with factuality, retrieval, and reasoning | Multi-hop questions over Wikipedia evidence | Known answers plus required source integration | Good model for evidence-grounded retrieval/reasoning tasks. |
| DeepResearch Bench | End-to-end deep research agents | Expert-crafted PhD-level research tasks across domains | Expert evaluation/rubrics | Relevant to open-ended research reports, but more expensive and less automatically grounded. |
| SWE-bench | Software agents resolving GitHub issues | Mining issue/PR pairs from real repositories | Tests from merged PR context | Best precedent for naturally occurring human outcome labels. |
| MLE-bench | ML engineering agents | Kaggle competitions curated as agent tasks | Kaggle leaderboard scores | Strong precedent for measuring resource scaling and real-world agent work. |
| RE-Bench | AI R&D/research engineering agents | Seven realistic ML research-engineering environments | Task-specific scoring plus human expert baselines | Strong precedent for expert baselines and time budgets. |
| MLAgentBench | ML experimentation agents | Hand-built ML experiment environments | Task success / performance improvement | Useful for iterative experimental work, but narrower than general research. |
| WebArena / OSWorld / AgentBench | Interactive agents in web, OS, and tool environments | Reproducible environments with task-specific success checks | Environment state or execution-based checks | Relevant for harness design, but less focused on research-question truth. |
| Humanity's Last Exam | Frontier expert knowledge | Expert-authored closed-ended questions | Unambiguous, verifiable expert answers | Useful for benchmark-quality process, less useful for agentic research because retrieval is intentionally insufficient. |

## Benchmark Families

### 1. Browsing and Deep-Research Search

BrowseComp is the canonical recent benchmark for web-browsing agents. It contains hard-to-find factual questions with short, verifiable answers. OpenAI's public description emphasizes dataset diversity, difficulty, test-time compute scaling, and aggregation strategies. This matters because the benchmark creator should preserve "short/verifiable answer" discipline even when tasks require long search.

The weakness is that public web benchmarks are vulnerable to leakage and saturation. Anthropic has documented cases where BrowseComp answers leaked into searchable web surfaces and affected evaluation. Newer work such as BrowseComp-Plus, LoHoSearch, and EvoBrowseComp is responding to this by making evaluation more transparent, using controlled corpora or automated construction, and emphasizing evolving knowledge.

Implication: a benchmark creator should not rely only on static web questions. It should either control the evidence corpus, refresh tasks over time, or use temporal cutoffs so the answer cannot be solved by memorized benchmark artifacts.

### 2. Long-Horizon Search and Automated Hardness

LoHoSearch is especially relevant. Its authors argue that human-authored search benchmarks hit a difficulty ceiling because annotators cannot systematically reason over global entity statistics and search-space structure. Their construction pipeline uses a large knowledge graph to select relations with large search spaces, assemble structurally complex questions, require unique answers, and then human-verify the result.

This is close to the benchmark creator's "difficulty engine" idea. It suggests that hard-question generation should use corpus statistics, graph structure, candidate-set size, relation composition, and uniqueness checks rather than asking humans or agents to freehand difficult prompts.

Implication: for Alpha Research, the benchmark creator should score candidate tasks before running agents:

- size of candidate answer space
- number of evidence hops
- dispersion of evidence across documents
- uniqueness of the answer
- lexical mismatch between prompt and evidence
- whether simple retrieval baselines can solve the task

### 3. General Tool-Using Assistants

GAIA is a useful philosophical reference because it deliberately asks questions that are conceptually simple for humans but difficult for tool-using AI systems. Its construction separates public questions from hidden answers for leaderboard integrity and reports a large gap between humans and GPT-4 with plugins at release.

AgentBench, WebArena, and OSWorld test agents in interactive environments. Their key contribution is not the subject matter; it is reproducible task setup and execution-based grading. WebArena uses self-hosted realistic websites; OSWorld defines task setup configurations and custom evaluation scripts for desktop workflows.

Implication: even if the benchmark creator focuses on research tasks, it should borrow environment reproducibility ideas: fixed corpus snapshots, fixed tool permissions, deterministic graders where possible, and run artifacts that can be replayed.

### 4. Naturally Occurring Human Outcome Benchmarks

SWE-bench is the strongest precedent for using naturally occurring human work as ground truth. It mines GitHub issues and corresponding pull requests, then asks an agent to edit the codebase so tests pass. Its value comes from a real-world problem statement, a real human resolution, and an execution-based verifier.

MLE-bench similarly uses Kaggle competitions as realistic ML engineering tasks, with public leaderboards as human baselines and scoring anchors. RE-Bench goes further by comparing frontier agents against 71 human expert attempts on realistic ML research-engineering tasks.

These benchmarks are closest to the user's proposed "GitHub issue to fix" and "before/after human work" ideas.

Implication: the benchmark creator should prefer naturally occurring outcomes when possible:

- issue -> merged fix
- draft -> final memo
- question -> accepted answer
- claim -> cited evidence
- research plan -> published result
- incident report -> root cause / remediation

These reduce label invention, but they require careful leakage control and checks that the future output was inferable from the provided evidence.

### 5. Evidence-Anchored RAG and Citation Benchmarks

FRAMES evaluates retrieval-augmented systems on factuality, retrieval accuracy, and reasoning using multi-hop questions over Wikipedia. Its task design is useful because it evaluates both final-answer correctness and whether the system retrieved or used the right evidence.

BrowseComp-Plus also pushes toward disentangling deep-research components: retrieval effectiveness, citation accuracy, and context engineering. That is aligned with the benchmark creator's need to know whether an agent failed because it searched badly, synthesized badly, cited badly, or lacked enough budget.

Implication: every benchmark-creator task should store:

- final answer
- minimal supporting evidence
- allowed corpus snapshot
- answer-verification rule
- evidence-verification rule
- known distractors or near misses

Final-answer accuracy alone is too weak for research-agent evaluation.

### 6. Expert Closed-Ended Frontier Benchmarks

Humanity's Last Exam is useful mainly as a benchmark-quality process reference. It uses expert-authored questions across many fields with unambiguous, verifiable answers that should not be quickly answerable by internet retrieval. It demonstrates the value of subject-matter expert contribution, bug bounties, and answer clarity.

But it is less directly aligned with Alpha Research if the goal is agentic deep research. HLE evaluates expert knowledge and reasoning, not whether an agent can operate over a messy local dataset with traceable citations.

Implication: borrow the quality bar, not the task format.

## Benchmark-Construction Methods

### Human-authored hard tasks

Used by BrowseComp, GAIA, HLE, and DeepResearch Bench.

Strengths:

- good semantic naturalness
- can target realistic user needs
- can include domain expertise

Weaknesses:

- expensive
- hard to scale
- subject to annotator blind spots
- can saturate when public
- hard to measure whether difficulty is intrinsic or accidental

### Programmatic or corpus-statistical task generation

Used most clearly by LoHoSearch. Also common in synthetic RAG and structured-data QA.

Strengths:

- scalable
- can deliberately control search-space size and evidence structure
- supports uniqueness checks and automatic rejection

Weaknesses:

- risks artificial tasks
- can over-optimize for graph/search complexity rather than useful research
- requires human verification for naturalness and ambiguity

### Naturally occurring labels

Used by SWE-bench, MLE-bench, and many issue/PR, leaderboard, and accepted-answer datasets.

Strengths:

- labels come from real human outcomes
- commercial relevance is higher
- verifiers can sometimes be deterministic

Weaknesses:

- leakage risk is high
- the human outcome may depend on hidden context
- labels can encode path dependence rather than the uniquely correct answer

### Temporal cutoffs

Used in forecasting-style and evolving-knowledge benchmarks, and proposed by EvoBrowseComp-like work.

Strengths:

- ground truth can be produced from the future
- leakage can be controlled by timestamp
- benchmark can refresh over time

Weaknesses:

- true future events are not always predictable from past evidence
- forecasting skill and evidence synthesis can be confounded
- careless corpus construction leaks post-cutoff evidence

### LLM/judge-assisted generation and grading

Common in newer benchmark pipelines and covered by LLM-as-a-Judge surveys.

Strengths:

- scalable triage
- useful for candidate generation, disagreement mining, rubric checks, and evidence extraction

Weaknesses:

- judge bias and inconsistency
- false confidence
- correlated errors between solver and judge
- weak for final ground truth unless independently audited

The benchmark creator should use LLM judges as filters and auditors, not as sole truth engines.

## Difficulty and Scaling

The user's notes about scaling are consistent with the most relevant benchmark trend. BrowseComp reports test-time compute and aggregation strategies. MLE-bench explicitly studies resource scaling for ML agents. RE-Bench uses fixed time budgets and human expert comparisons. LoHoSearch argues that existing search benchmarks have saturated and need harder long-horizon construction.

A benchmark creator should classify tasks by scaling behavior:

- Saturating: a few attempts solve it; useful for smoke tests, not frontier difficulty.
- Linear-scalable: more agents solve it because the task is mostly exhaustive search or partitionable work.
- Sublinear-hard: additional agents help, but slowly; likely evidence synthesis, abstraction, or ambiguity-resolution bottlenecks.
- Non-scaling: extra agents do not help; often impossible, under-specified, contaminated, or badly judged.
- Fragile: answers vary for shallow prompt/search reasons; useful as a diagnostics set, not a stable benchmark.

This should become a first-class metric rather than a post-hoc analysis.

## Known Failure Modes

The literature repeatedly points to these benchmark risks:

- Contamination: public benchmark items or answers leak into model training data or live search results.
- Saturation: models quickly exceed useful score ranges, especially on static public benchmarks.
- Ambiguous truth: answer keys are wrong, incomplete, or underspecified.
- Search-heavy false difficulty: tasks require brute-force scanning rather than intelligence.
- Judge unreliability: LLM judges reward style or plausible citations instead of correctness.
- Hidden context: naturally occurring labels depend on information not present in the benchmark input.
- Tool/environment drift: live web APIs and changing pages make results irreproducible.
- Overfitting to current agents: disagreement-mined tasks can encode temporary weaknesses.

BetterBench is relevant here because it argues benchmark quality depends on lifecycle design, replication, statistical reporting, validated automatic evaluation, and clear definitions of the target capability.

## Design Implications For Alpha Research

The benchmark creator should be framed as a benchmark factory, not as one benchmark.

Recommended architecture:

1. Candidate source layer
   - Hugging Face datasets
   - GitHub issue/PR datasets
   - citation/evidence datasets
   - temporal event datasets
   - Alpha Research canonical datasets

2. Task generator
   - prompt template
   - corpus slice
   - answer candidate
   - evidence candidate
   - metadata about hops, dispersion, candidate-space size, timestamps, and corpus split

3. Truth engine
   - deterministic verifier when possible
   - official record or future label when possible
   - citation/evidence verifier for research tasks
   - human audit for selected cases

4. Difficulty engine
   - retrieval-only baseline
   - single-agent baseline
   - multi-agent attempts
   - judge/synthesis attempt
   - scaling-curve classification

5. Quality gate
   - ambiguity review
   - leakage review
   - judge reliability audit
   - reproducibility check
   - cost report

## Practical Shortlist For The First Pilot

Based on the literature, the strongest first pilot is not Gutenberg unless the goal is specifically retrieval. For a broader research-agent benchmark, the strongest families are:

1. GitHub issue-to-fix
   - Inspired by SWE-bench.
   - Natural labels from merged PRs.
   - Strong verifiers if tests exist.
   - Directly relevant to Codex/Claude Code.

2. Citation support / evidence finding
   - Inspired by FRAMES, BrowseComp-Plus, and citation-grounded QA.
   - Strong fit for deep research and Alpha Research reports.
   - Needs human spot-checking because citations often do not fully support claims.

3. Temporal evolving-knowledge tasks
   - Inspired by EvoBrowseComp and dynamic benchmark literature.
   - Strong leakage control if the corpus snapshot is enforceable.
   - Needs care to separate predictable-from-past from unknowable future events.

4. Kaggle/ML engineering tasks
   - Inspired by MLE-bench, RE-Bench, and MLAgentBench.
   - Strong economic relevance and resource-scaling literature.
   - More expensive to run and less central to general research QA.

## Recommended Next Step

Before implementing the benchmark creator, run a dataset discovery bakeoff:

- Search Hugging Face and public benchmark datasets for the four pilot families above.
- Shortlist 10-20 datasets.
- Preview rows and licenses.
- Score each dataset on ground-truth strength, evidence availability, task naturalness, contamination risk, and expected scaling behavior.
- Create 10 candidate tasks for the top 3 dataset families.
- Run retrieval-only, one-agent, and five-agent baselines before scaling further.

The first milestone should be a 25-task pilot with reliable truth and a scaling-curve report, not a large benchmark.

## Sources

- BrowseComp: OpenAI, "BrowseComp: A Simple Yet Challenging Benchmark for Browsing Agents", https://openai.com/index/browsecomp/ and https://cdn.openai.com/pdf/5e10f4ab-d6f7-442e-9508-59515c65e35d/browsecomp.pdf
- BrowseComp-Plus: Chen et al., "BrowseComp-Plus: A More Fair and Transparent Evaluation Benchmark of Deep-Research Agent", https://arxiv.org/abs/2508.06600
- LoHoSearch: Zhao et al., "LoHoSearch: Benchmarking Long-Horizon Search Agents Beyond the Human Difficulty Ceiling", https://arxiv.org/html/2606.12837
- EvoBrowseComp: "Benchmarking Search Agents on Evolving Knowledge", https://arxiv.org/html/2606.13120
- GAIA: Mialon et al., "GAIA: a benchmark for General AI Assistants", https://arxiv.org/abs/2311.12983
- FRAMES: "Factuality, Retrieval, And reasoning MEasurement Set", https://arxiv.org/pdf/2409.12941
- DeepResearch Bench: https://github.com/Ayanami0730/deep_research_bench and https://deepresearch-bench.github.io/static/papers/deepresearch-bench.pdf
- SWE-bench: Jimenez et al., "Can Language Models Resolve Real-World GitHub Issues?", https://arxiv.org/abs/2310.06770 and https://www.swebench.com/
- MLE-bench: OpenAI, "MLE-bench", https://openai.com/index/mle-bench/
- RE-Bench: METR, "Evaluating frontier AI R&D capabilities of language model agents", https://metr.org/blog/2024-11-22-evaluating-r-d-capabilities-of-llms/ and https://arxiv.org/abs/2411.15114
- MLAgentBench: Huang et al., "Evaluating Language Agents on Machine Learning Experimentation", https://arxiv.org/abs/2310.03302
- WebArena: Zhou et al., "A Realistic Web Environment for Building Autonomous Agents", https://arxiv.org/abs/2307.13854 and https://webarena.dev/
- OSWorld: "Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments", https://os-world.github.io/
- AgentBench: Liu et al., "Evaluating LLMs as Agents", https://arxiv.org/abs/2308.03688
- Humanity's Last Exam: Phan et al., "Humanity's Last Exam", https://arxiv.org/abs/2501.14249
- BetterBench: Reuel et al., "Assessing AI Benchmarks, Uncovering Issues, and Establishing Best Practices", https://arxiv.org/abs/2411.12990 and https://betterbench.stanford.edu/
- LLM-as-a-Judge survey: Gu et al., "A Survey on LLM-as-a-Judge", https://arxiv.org/abs/2411.15594
- Data contamination survey: Chen et al., "Benchmarking Large Language Models Under Data Contamination: A Survey from Static to Dynamic Evaluation", https://aclanthology.org/2025.emnlp-main.511/
- Anthropic, "Eval awareness in Claude Opus 4.6's BrowseComp performance", https://www.anthropic.com/engineering/eval-awareness-browsecomp
