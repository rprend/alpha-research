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

  await synthesizeReviewer(repo, reviewer, paths, data)
  printSummary(reviewer, paths, data)
}

function printHelp() {
  console.log(`precheck

Build a local reviewer-specific GitHub PR review profile.

Usage:
  precheck
  precheck --reviewer <github-login>

Run inside a GitHub repository. precheck uses local git, gh, and claude auth.
It stores reviewer data under ~/.precheck and never asks for GitHub tokens.`)
}

function parseArgs(rawArgs) {
  const parsed = { help: false, reviewer: null }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
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
  requireCommand('claude', 'Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code')

  const ghAuth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' })
  if (ghAuth.status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run: gh auth login')
  }

  const claudeCheck = spawnSync('claude', ['--version'], { encoding: 'utf8' })
  if (claudeCheck.status !== 0) {
    throw new Error('Claude Code CLI is installed but not ready. Authenticate Claude Code locally, then retry.')
  }
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

async function synthesizeReviewer(repo, reviewer, paths, data) {
  console.log('\nSynthesizing reviewer profile with Claude Code...')
  const prompt = synthesisPrompt(repo, reviewer, paths)
  const result = await runClaude(prompt, dirname(paths.raw))
  const sections = parseClaudeSections(result)

  writeFileSync(join(paths.synthesized, 'reviewer-profile.md'), sections.profile || fallbackProfile(reviewer, data))
  writeFileSync(join(paths.synthesized, 'claude-reviewer.md'), sections.instructions || fallbackInstructions(reviewer))
  writeFileSync(join(paths.synthesized, 'review-prompt.md'), sections.prompt || fallbackPrompt(reviewer))
}

function synthesisPrompt(repo, reviewer, paths) {
  return `You are analyzing historical GitHub PR review comments from one reviewer.

Repository: ${repo.fullName}
Reviewer: ${reviewer}

Input files:
- ${join(paths.raw, 'comments.json')}
- ${join(paths.raw, 'reviews.json')}
- ${join(paths.raw, 'prs.json')}

Read those files and produce exactly three delimited markdown sections:

--- reviewer-profile.md ---
# Reviewer Profile: ${reviewer}

Include:
- Summary
- Recurring Themes
- Common Gotchas
- Before Requesting Review checklist
- Evidence with PR numbers and short quotes from prior comments

--- claude-reviewer.md ---
# Review Like ${reviewer}

Reusable Claude Code instructions for reviewing future diffs like this reviewer.

--- review-prompt.md ---
Short copy-paste prompt for a future branch review.

Analyze recurring review themes, code patterns, tests, type-safety expectations, naming/style, architecture/design, frontend/product behavior, examples with citations, common gotchas, and what this reviewer probably does not care about.

Be concrete. Avoid personal attacks. Treat this as a professional review-preparation profile.`
}

function runClaude(prompt, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt], { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude Code synthesis failed. Authenticate Claude Code locally if needed.\n${stderr.trim()}`))
      } else {
        resolve(stdout)
      }
    })
  })
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
  console.log(`\nPrecheck profile ready for ${reviewer}`)
  console.log(`- Comments: ${data.comments.length}`)
  console.log(`- Reviews: ${data.reviews.length}`)
  console.log(`- Profile: ${join(paths.synthesized, 'reviewer-profile.md')}`)
  console.log(`- Claude instructions: ${join(paths.synthesized, 'claude-reviewer.md')}`)
  console.log(`- Prompt: ${join(paths.synthesized, 'review-prompt.md')}`)

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
