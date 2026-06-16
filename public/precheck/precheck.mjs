#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const RECENT_PR_LIMIT = 100
const COMMENT_LIMIT = 500
const REVIEW_LIMIT = 200
const PRECHECK_HOME = join(homedir(), '.precheck')
const CODEX_HOME = process.env.CODEX_HOME || join(homedir(), '.codex')

const args = process.argv.slice(2)
const options = parseArgs(args)

main().catch((error) => {
  console.error(`precheck: ${error.message}`)
  process.exit(1)
})

async function main() {
  if (options.help) {
    printHelp()
    return
  }

  await checkPrerequisites()
  const agentRunners = detectAgentRunners()
  const repo = await detectRepo()
  const reviewer = options.reviewer || await chooseReviewer(repo)
  const paths = repoPaths(repo, reviewer)

  mkdirSync(paths.raw, { recursive: true })
  mkdirSync(paths.synthesized, { recursive: true })

  const data = await collectReviewerData(repo, reviewer)
  writeJson(join(paths.raw, 'prs.json'), data.prs)
  writeJson(join(paths.raw, 'comments.json'), data.comments)
  writeJson(join(paths.raw, 'reviews.json'), data.reviews)

  console.log(`\nSaved raw GitHub review data in ${paths.raw}`)

  await synthesizeReviewer(repo, reviewer, paths, data, agentRunners)
  printSummary(reviewer, paths, data)
}

function printHelp() {
  console.log(`precheck

Build a local reviewer-specific GitHub PR review profile.

Usage:
  precheck
  precheck --reviewer <github-login>
  precheck --interactive

Run inside a GitHub repository. precheck uses local git, gh, and Claude Code or Codex CLI auth.
It stores reviewer data under ~/.precheck and never asks for GitHub tokens.`)
}

function parseArgs(rawArgs) {
  const parsed = { help: false, interactive: false, reviewer: null }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--interactive') {
      parsed.interactive = true
    } else if (arg === '--reviewer') {
      parsed.reviewer = rawArgs[index + 1] ?? null
      index += 1
    } else if (arg.startsWith('--reviewer=')) {
      parsed.reviewer = arg.slice('--reviewer='.length)
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (parsed.reviewer !== null) {
    parsed.reviewer = parsed.reviewer.trim().replace(/^@/, '')
    if (!parsed.reviewer) throw new Error('Expected a GitHub login after --reviewer.')
  }

  return parsed
}

async function checkPrerequisites() {
  requireCommand('git', 'Install Git: https://git-scm.com/downloads')
  requireCommand('gh', 'Install GitHub CLI: https://cli.github.com/')

  const ghAuth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' })
  if (ghAuth.status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run: gh auth login')
  }
}

function detectAgentRunners() {
  const runners = []
  const claudeCheck = spawnSync('claude', ['--version'], { encoding: 'utf8' })
  if (claudeCheck.status === 0) {
    runners.push({
      name: 'Claude Code',
      command: 'claude',
      args: (prompt) => ['-p', prompt],
    })
  }

  const codexCheck = spawnSync('codex', ['--version'], { encoding: 'utf8' })
  if (codexCheck.status === 0) {
    runners.push({
      name: 'Codex CLI',
      command: 'codex',
      args: (prompt) => ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', prompt],
    })
  }

  if (runners.length === 0) {
    throw new Error('Precheck requires Claude Code CLI or Codex CLI for synthesis. Install and authenticate one of them, then retry.')
  }

  console.log(`Using synthesis runner fallback order: ${runners.map((runner) => runner.name).join(' -> ')}`)
  return runners
}

function requireCommand(command, installHint) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') {
    throw new Error(`${command} is required. ${installHint}`)
  }
}

async function detectRepo() {
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' })
  if (remote.status === 0) {
    const parsed = parseGitHubRemote(remote.stdout.trim())
    if (parsed) return parsed
  }

  const rl = createInterface({ input, output })
  const answer = await rl.question('GitHub repo (owner/repo): ')
  rl.close()
  const match = answer.trim().match(/^([^/\s]+)\/([^/\s]+)$/)
  if (!match) throw new Error('Expected repo in owner/repo format.')
  return { owner: match[1], repo: match[2], fullName: `${match[1]}/${match[2]}` }
}

function parseGitHubRemote(remote) {
  const ssh = remote.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2], fullName: `${ssh[1]}/${ssh[2]}` }

  const https = remote.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
  if (https) return { owner: https[1], repo: https[2], fullName: `${https[1]}/${https[2]}` }

  return null
}

async function chooseReviewer(repo) {
  console.log(`Inspecting recent PR activity in ${repo.fullName}...`)
  const prs = await ghJson(`repos/${repo.fullName}/pulls?state=all&per_page=${RECENT_PR_LIMIT}`)
  const stats = new Map()

  for (const pr of prs) {
    const [reviews, comments] = await Promise.all([
      ghJson(`repos/${repo.fullName}/pulls/${pr.number}/reviews?per_page=100`),
      ghJson(`repos/${repo.fullName}/pulls/${pr.number}/comments?per_page=100`),
    ])

    for (const review of reviews) {
      addReviewerActivity(stats, review.user?.login, pr.number, review.submitted_at)
    }
    for (const comment of comments) {
      addReviewerActivity(stats, comment.user?.login, pr.number, comment.created_at, 1)
    }
  }

  const reviewers = [...stats.entries()]
    .map(([login, value]) => ({
      login,
      prCount: value.prs.size,
      commentCount: value.commentCount,
      latest: value.latest,
    }))
    .sort((a, b) => b.commentCount - a.commentCount || b.prCount - a.prCount)
    .slice(0, 15)

  if (reviewers.length === 0) {
    console.log(`\nNo recent PR review comments were found in ${repo.fullName}.`)
    console.log('Run precheck in a repo with coworker PR review history, or pass a reviewer explicitly:')
    console.log('  precheck --reviewer <github-login>')
    return promptReviewer()
  }

  if (options.interactive) {
    return chooseReviewerInteractively(reviewers)
  }

  const selected = reviewers[0]
  console.log(`\nSelected reviewer: ${selected.login}`)
  console.log(`Found ${selected.commentCount} comments across ${selected.prCount} PRs, latest ${selected.latest?.slice(0, 10) ?? 'unknown'}.`)
  console.log('Pass --interactive to choose a different reviewer.')
  return selected.login
}

async function chooseReviewerInteractively(reviewers) {
  console.log('\nChoose a reviewer to model:\n')
  reviewers.forEach((reviewer, index) => {
    const latest = reviewer.latest ? reviewer.latest.slice(0, 10) : 'unknown'
    console.log(`${index + 1}. ${reviewer.login.padEnd(16)} ${reviewer.commentCount} comments across ${reviewer.prCount} PRs, latest ${latest}`)
  })
  console.log(`${reviewers.length + 1}. Enter manually`)

  const rl = createInterface({ input, output })
  const answer = await rl.question('\nSelection: ')
  rl.close()

  const selected = Number.parseInt(answer.trim(), 10)
  if (selected >= 1 && selected <= reviewers.length) return reviewers[selected - 1].login
  return promptReviewer()
}

function addReviewerActivity(stats, login, prNumber, date, commentCount = 0) {
  if (!login) return
  if (!stats.has(login)) stats.set(login, { prs: new Set(), commentCount: 0, latest: null })
  const stat = stats.get(login)
  stat.prs.add(prNumber)
  stat.commentCount += commentCount
  if (date && (!stat.latest || date > stat.latest)) stat.latest = date
}

async function promptReviewer() {
  const rl = createInterface({ input, output })
  const answer = await rl.question('Reviewer GitHub login: ')
  rl.close()
  const reviewer = answer.trim()
  if (!reviewer) throw new Error('Reviewer login is required.')
  return reviewer
}

async function collectReviewerData(repo, reviewer) {
  console.log(`\nCollecting ${reviewer}'s review history...`)
  const prs = await ghJson(`repos/${repo.fullName}/pulls?state=all&per_page=${RECENT_PR_LIMIT}`)
  const comments = []
  const reviews = []
  const touchedPrs = []

  for (const pr of prs) {
    if (comments.length >= COMMENT_LIMIT && reviews.length >= REVIEW_LIMIT) break

    const [prReviews, prComments] = await Promise.all([
      ghJson(`repos/${repo.fullName}/pulls/${pr.number}/reviews?per_page=100`),
      ghJson(`repos/${repo.fullName}/pulls/${pr.number}/comments?per_page=100`),
    ])

    const reviewerComments = prComments.filter((comment) => comment.user?.login === reviewer)
    const reviewerReviews = prReviews.filter((review) => review.user?.login === reviewer)

    if (reviewerComments.length > 0 || reviewerReviews.length > 0) {
      touchedPrs.push({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? null,
        state: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      })
    }

    for (const comment of reviewerComments) {
      if (comments.length >= COMMENT_LIMIT) break
      comments.push({
        reviewer,
        prNumber: pr.number,
        prTitle: pr.title,
        prAuthor: pr.user?.login ?? null,
        file: comment.path,
        line: comment.line ?? comment.original_line ?? null,
        body: comment.body ?? '',
        diffHunk: comment.diff_hunk ?? '',
        createdAt: comment.created_at,
        url: comment.html_url,
      })
    }

    for (const review of reviewerReviews) {
      if (reviews.length >= REVIEW_LIMIT) break
      reviews.push({
        reviewer,
        prNumber: pr.number,
        prTitle: pr.title,
        state: review.state,
        body: review.body ?? '',
        submittedAt: review.submitted_at,
        url: review.html_url ?? pr.html_url,
      })
    }
  }

  if (comments.length === 0 && reviews.length === 0) {
    throw new Error(`No review comments or reviews found for ${reviewer} in the last ${RECENT_PR_LIMIT} PRs for ${repo.fullName}. Try a reviewer who has commented on recent PRs, or run precheck in a repo with more review history.`)
  }

  return { prs: touchedPrs, comments, reviews }
}

async function synthesizeReviewer(repo, reviewer, paths, data, agentRunners) {
  console.log('\nSynthesizing reviewer evidence map...')
  const evidenceMap = await runAgent(agentRunners, evidenceMapPrompt(repo, reviewer), paths.raw)
  writeFileSync(join(paths.synthesized, 'evidence-map.md'), evidenceMap)

  console.log('Synthesizing reviewer patterns...')
  const reviewerPatterns = await runAgent(agentRunners, patternSynthesisPrompt(repo, reviewer, paths), paths.root)
  writeFileSync(join(paths.synthesized, 'reviewer-patterns.md'), reviewerPatterns)

  console.log('Filtering generic patterns...')
  const filteredPatterns = await runAgent(agentRunners, antiGenericFilterPrompt(repo, reviewer, paths), paths.root)
  writeFileSync(join(paths.synthesized, 'filtered-patterns.md'), filteredPatterns)

  console.log('Writing final reviewer artifacts...')
  const result = await runAgent(agentRunners, finalArtifactsPrompt(repo, reviewer, paths), paths.root)
  const sections = parseClaudeSections(result)

  writeFileSync(join(paths.synthesized, 'reviewer-profile.md'), sections.profile || fallbackProfile(reviewer, data))
  writeFileSync(join(paths.synthesized, 'claude-reviewer.md'), sections.instructions || fallbackInstructions(reviewer))
  writeFileSync(join(paths.synthesized, 'review-prompt.md'), sections.prompt || fallbackPrompt(reviewer))

  const skill = installReviewerSkill(reviewer, paths)
  console.log(`Installed reviewer skill: ${skill.name}`)
  console.log(`- Skill: ${skill.path}`)
}

function evidenceMapPrompt(repo, reviewer) {
  return `You are mining historical GitHub PR review data to infer a reviewer's tacit review model.

Repository: ${repo.fullName}
Reviewer: ${reviewer}

Input files:
- comments.json
- reviews.json
- prs.json

Do not summarize the reviewer as "cares about tests," "likes readability," or "prefers clean code."
Those are topics. Mine for review moves: specific triggers, mechanisms, distinctions, failure modes, representative cases, and reusable pre-review actions.

First produce an evidence map. Do not synthesize the final persona yet.

Extract evidence into these buckets:

1. Hidden mechanisms the reviewer seems to notice
2. False explanations or rejected approaches
3. Repeated failure modes
4. Useful distinctions
5. Local procedures
6. Before/after deltas
7. Tacit taste judgments
8. Review triggers
9. Evidence of what the reviewer does not care about

For each evidence item, include:
- Bucket
- Short name
- Raw quote
- PR number
- File/path if available
- What the author did, when inferable from the comment or diff hunk
- What the reviewer noticed
- Your interpretation
- Confidence: high / medium / low

Use short quotes. Prefer concrete examples over broad claims.`
}

function patternSynthesisPrompt(repo, reviewer, paths) {
  return `Using the evidence map, synthesize the reviewer persona.

Repository: ${repo.fullName}
Reviewer: ${reviewer}

Input files:
- ${join(paths.synthesized, 'evidence-map.md')}
- ${join(paths.raw, 'comments.json')}
- ${join(paths.raw, 'reviews.json')}
- ${join(paths.raw, 'prs.json')}

The goal is not a personality profile. The goal is a predictive model of how this reviewer reviews code.

Produce 12-20 reviewer patterns. Each pattern must include:

## [Pattern name]

Review shape:
Choose one or two:
- hidden mechanism
- false explanation
- useful distinction
- repeated failure mode
- local procedure
- before/after delta
- unresolved tension
- named type
- transferable frame
- operationalized taste
- bottleneck
- compression

Reviewer move:
What the reviewer tends to notice or ask for.

Mechanism:
Why this matters technically, architecturally, or product-wise.

Concrete trigger:
What kind of diff, code, test, UI, migration, API, or workflow tends to provoke this review.

Likely comment:
A realistic comment this reviewer might leave, written in their review style but not impersonating exact wording.

How to precheck:
A concrete action the author should take before requesting review.

Representative examples:
Include 2-5 concrete historical examples for each high-value reviewer pattern.
Each example must include:
- PR number
- File/path if available
- What the author did
- What the reviewer noticed
- The reviewer's raw quote
- The general lesson this example teaches
- How a future author would detect the same issue before review

Evidence strength:
Explain whether this pattern is based on one strong example, several related examples, or repeated behavior across PRs.

Confidence:
high / medium / low

Reject generic patterns.
Bad: "The reviewer cares about tests."
Good: "The reviewer asks for tests when a helper encodes branching business behavior that future call sites could accidentally bypass."`
}

function antiGenericFilterPrompt(repo, reviewer, paths) {
  return `Review the synthesized reviewer patterns and remove or rewrite generic ones.

Repository: ${repo.fullName}
Reviewer: ${reviewer}

Input files:
- ${join(paths.synthesized, 'reviewer-patterns.md')}
- ${join(paths.synthesized, 'evidence-map.md')}

A bad pattern sounds like:
- "Reviewer cares about readability."
- "Reviewer wants better tests."
- "Reviewer prefers simple code."
- "Reviewer comments on architecture."

A good pattern sounds like:
- "Reviewer objects when a public API encodes a temporary migration state because it makes cleanup harder to prove."
- "Reviewer asks for tests around the boundary where mocked harness state diverges from production state."
- "Reviewer pushes back on abstractions that hide the lifecycle event that actually determines correctness."

For each pattern, ask:

1. Is there a mechanism?
2. Is there a specific trigger?
3. Is there a repeated failure mode or distinction?
4. Is there a reusable pre-review action?
5. Is it supported by concrete quotes?
6. Would this help predict a future review comment?

If the answer is no to 1, 2, or 5, discard or rewrite it.

Prefer patterns with 2-5 representative examples. A pattern with only one example can survive only if the mechanism is especially strong and the quote is specific. Discard patterns that cannot provide at least one concrete representative example.

Rank the remaining patterns by:
- Strength of mechanism
- Strength of evidence
- Predictive usefulness
- Specificity to this reviewer

Output only the strongest patterns. Preserve the representative examples under each pattern.`
}

function finalArtifactsPrompt(repo, reviewer, paths) {
  return `Using the filtered reviewer patterns, produce exactly three delimited markdown sections.

Repository: ${repo.fullName}
Reviewer: ${reviewer}

Input files:
- ${join(paths.synthesized, 'filtered-patterns.md')}
- ${join(paths.synthesized, 'evidence-map.md')}

--- reviewer-profile.md ---
# Reviewer Profile: ${reviewer}

Include:
- One-paragraph predictive summary
- Top reviewer patterns ranked by predictive strength
- Common review triggers
- Tacit distinctions this reviewer applies
- Repeated failure modes they catch
- What they seem not to care about
- Evidence table with PR numbers and short quotes

For each top pattern, carry forward 2-5 representative examples when available. Each example should include the PR number, file/path if available, what the author did, what the reviewer noticed, a short quote, the general lesson, and how to detect the same issue before review.

--- claude-reviewer.md ---
# Review Like ${reviewer}

Reusable Claude Code instructions for reviewing future diffs like this reviewer.

Write this as operational instructions:
- What to inspect first
- What diff shapes to scrutinize
- What tests or validation to expect
- What architectural/product risks to look for
- What comments to avoid because they are too generic
- How to distinguish high-confidence likely comments from speculation
- How to use the representative examples as analogies for current diffs

--- review-prompt.md ---
Short copy-paste prompt for a future branch review.

The prompt should ask Claude Code to:
1. Read the current branch diff.
2. Apply the reviewer patterns from claude-reviewer.md.
3. Produce likely review comments ranked by confidence.
4. Cite the matching historical reviewer pattern and representative example.
5. Suggest the smallest fix or validation step.
6. Separate likely comments from speculative ones.

Be concrete. Avoid personal attacks. Treat this as a professional review-preparation profile.`
}

async function runAgent(agentRunners, prompt, cwd) {
  const failures = []
  for (const agentRunner of agentRunners) {
    try {
      console.log(`- Trying ${agentRunner.name}...`)
      return await runAgentOnce(agentRunner, prompt, cwd)
    } catch (error) {
      failures.push(`${agentRunner.name}: ${error.message}`)
      console.log(`- ${agentRunner.name} failed; ${agentRunner === agentRunners.at(-1) ? 'no fallback remains.' : 'trying next runner.'}`)
    }
  }

  throw new Error(`All synthesis runners failed.\n${failures.join('\n\n')}`)
}

function runAgentOnce(agentRunner, prompt, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(agentRunner.command, agentRunner.args(prompt), { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${agentRunner.name} synthesis failed. Authenticate ${agentRunner.name} locally if needed.\n${stderr.trim()}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

function installReviewerSkill(reviewer, paths) {
  const skillName = `${slugifyReviewer(reviewer)}-reviewer`
  const skillDir = join(CODEX_HOME, 'skills', skillName)
  const skillPath = join(skillDir, 'SKILL.md')
  const instructionsPath = join(paths.synthesized, 'claude-reviewer.md')
  const profilePath = join(paths.synthesized, 'reviewer-profile.md')
  const promptPath = join(paths.synthesized, 'review-prompt.md')

  const instructions = existsSync(instructionsPath) ? readFileSync(instructionsPath, 'utf8').trim() : fallbackInstructions(reviewer).trim()
  const profile = existsSync(profilePath) ? readFileSync(profilePath, 'utf8').trim() : ''
  const reviewPrompt = existsSync(promptPath) ? readFileSync(promptPath, 'utf8').trim() : fallbackPrompt(reviewer).trim()
  const content = reviewerSkillContent(skillName, reviewer, instructions, profile, reviewPrompt, paths)

  mkdirSync(skillDir, { recursive: true })
  writeFileSync(skillPath, content)
  writeFileSync(join(paths.synthesized, 'reviewer-skill.md'), content)

  return { name: skillName, path: skillPath }
}

function reviewerSkillContent(skillName, reviewer, instructions, profile, reviewPrompt, paths) {
  return `---
name: ${skillName}
description: Review the current branch like ${reviewer}. Use this when asked to precheck a branch, run a reviewer-specific review, or make changes that ${reviewer} would likely request.
---

# Review Like ${reviewer}

Use this skill when the user asks for a review as ${reviewer}, asks to preempt ${reviewer}'s review, or says something like:

\`\`\`text
Run a review of my branch as ${reviewer}. Make the changes that they would suggest.
\`\`\`

## Workflow

1. Inspect the current branch diff against the repository's main branch.
2. Apply the reviewer patterns below to identify likely comments from ${reviewer}.
3. Rank likely comments by confidence and cite the matching historical pattern or representative example when available.
4. Separate likely comments from speculative ones.
5. Make the smallest reasonable code, test, documentation, or validation changes that would preempt high-confidence comments.
6. Run the relevant tests or checks for any changes you make.
7. Report what changed and which reviewer patterns were addressed.

## Reviewer Instructions

${instructions}

## Reviewer Profile

${profile || 'No reviewer profile was generated. Use the reviewer instructions above and the raw Precheck artifacts when available.'}

## Review Prompt

${reviewPrompt}

## Source Artifacts

Precheck generated this skill from:

- \`${join(paths.synthesized, 'evidence-map.md')}\`
- \`${join(paths.synthesized, 'reviewer-patterns.md')}\`
- \`${join(paths.synthesized, 'filtered-patterns.md')}\`
- \`${join(paths.synthesized, 'reviewer-profile.md')}\`
- \`${join(paths.synthesized, 'claude-reviewer.md')}\`
- \`${join(paths.synthesized, 'review-prompt.md')}\`
`
}

function slugifyReviewer(reviewer) {
  return String(reviewer)
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'reviewer'
}

function parseClaudeSections(text) {
  return {
    profile: section(text, 'reviewer-profile.md'),
    instructions: section(text, 'claude-reviewer.md'),
    prompt: section(text, 'review-prompt.md'),
  }
}

function section(text, name) {
  const pattern = new RegExp(`---\\s*${escapeRegExp(name)}\\s*---\\n([\\s\\S]*?)(?=\\n---\\s*[^\\n]+\\s*---|$)`, 'i')
  const match = text.match(pattern)
  return match?.[1]?.trimStart() ?? ''
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fallbackProfile(reviewer, data) {
  const examples = data.comments.slice(0, 5).map((comment) => `- PR #${comment.prNumber}, \`${comment.file}\`: ${quote(comment.body)}`).join('\n')
  return `# Reviewer Profile: ${reviewer}

## Summary

Claude did not return a parseable profile. Raw reviewer data was collected successfully.

## Evidence Sample

${examples}

## Before Requesting Review

- [ ] Open \`raw/comments.json\` and \`raw/reviews.json\`.
- [ ] Re-run \`precheck\` after authenticating Claude Code locally.
`
}

function fallbackInstructions(reviewer) {
  return `# Review Like ${reviewer}

Use the raw reviewer data collected by precheck to identify likely review themes. Separate high-confidence findings from speculative ones and suggest the smallest fix for each likely comment.
`
}

function fallbackPrompt(reviewer) {
  return `Use the reviewer profile in \`synthesized/claude-reviewer.md\`.

Review my current branch diff as ${reviewer}. Identify likely comments they would leave, explain why based on historical patterns, and suggest fixes.
`
}

function printSummary(reviewer, paths, data) {
  const skillName = `${slugifyReviewer(reviewer)}-reviewer`
  console.log(`\nPrecheck profile ready for ${reviewer}`)
  console.log(`- Comments: ${data.comments.length}`)
  console.log(`- Reviews: ${data.reviews.length}`)
  console.log(`- Profile: ${join(paths.synthesized, 'reviewer-profile.md')}`)
  console.log(`- Claude instructions: ${join(paths.synthesized, 'claude-reviewer.md')}`)
  console.log(`- Prompt: ${join(paths.synthesized, 'review-prompt.md')}`)
  console.log(`- Skill: ${join(CODEX_HOME, 'skills', skillName, 'SKILL.md')}`)

  const profilePath = join(paths.synthesized, 'reviewer-profile.md')
  if (existsSync(profilePath)) {
    const profile = readFileSync(profilePath, 'utf8')
    const preview = profile.split('\n').slice(0, 30).join('\n')
    console.log(`\n${preview}`)
  }
}

function repoPaths(repo, reviewer) {
  const root = join(PRECHECK_HOME, 'repos', `${repo.owner}__${repo.repo}`, 'reviewers', reviewer)
  return {
    root,
    raw: join(root, 'raw'),
    synthesized: join(root, 'synthesized'),
  }
}

async function ghJson(path) {
  const output = await run('gh', ['api', path])
  return JSON.parse(output)
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`${command} ${commandArgs.join(' ')} failed.\n${stderr.trim()}`))
      else resolve(stdout)
    })
  })
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function quote(value) {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim()
  return compact.length > 100 ? `${compact.slice(0, 97)}...` : compact
}
