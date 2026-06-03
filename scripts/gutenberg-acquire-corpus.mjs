import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/gutenberg-semantic-benchmark')
const localDir = join(experimentDir, '.local')
const catalogDir = join(localDir, 'catalog')
const rawDir = join(localDir, 'raw')
const cleanDir = join(localDir, 'clean')
const corpusDir = join(localDir, 'corpus')
const catalogGzPath = join(catalogDir, 'pg_catalog.csv.gz')
const catalogCsvPath = join(catalogDir, 'pg_catalog.csv')
const manifestPath = join(corpusDir, 'corpus-manifest.json')
const inventoryPath = join(corpusDir, 'source-inventory.jsonl')
const exclusionsPath = join(corpusDir, 'exclusions.jsonl')

const target = Number(valueForArg('--target') ?? 5_000)
const maxScan = Number(valueForArg('--max-scan') ?? Math.max(target * 5, 25_000))
const concurrency = Number(valueForArg('--concurrency') ?? 8)
const minWords = Number(valueForArg('--min-words') ?? 2_000)
const refreshCatalog = process.argv.includes('--refresh-catalog')
const catalogUrl = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz'
const chunkingVersion = 'real-gutenberg-clean-v1'

function valueForArg(name) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return raw ? raw.slice(name.length + 1) : null
}

function ensureDirs() {
  for (const dir of [catalogDir, rawDir, cleanDir, corpusDir]) mkdirSync(dir, { recursive: true })
}

async function downloadFile(url, path, { retries = 3 } = {}) {
  if (existsSync(path) && statSync(path).size > 0) return { status: 'cached', url, path }
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AlphaResearchGutenbergBenchmark/1.0 (contact: local research benchmark)',
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length) throw new Error('empty response')
      writeFileSync(path, buffer)
      return { status: 'downloaded', url, path, bytes: buffer.length }
    } catch (error) {
      lastError = error
      await sleep(300 * attempt)
    }
  }
  throw new Error(`${url}: ${lastError.message}`)
}

async function ensureCatalog() {
  if (refreshCatalog || !existsSync(catalogGzPath)) {
    await downloadFile(catalogUrl, catalogGzPath)
  }
  if (refreshCatalog || !existsSync(catalogCsvPath)) {
    await pipeline(createReadStream(catalogGzPath), createGunzip(), writeFileStream(catalogCsvPath))
  }
}

function writeFileStream(path) {
  return createWriteStream(path)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function catalogRecords() {
  const rows = parseCsv(readFileSync(catalogCsvPath, 'utf8'))
  const header = rows.shift()
  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])))
}

function isLikelyBook(record) {
  if (record.Type !== 'Text') return false
  if (record.Language !== 'en') return false
  const title = record.Title.toLowerCase()
  const subjects = record.Subjects.toLowerCase()
  const shelves = record.Bookshelves.toLowerCase()
  if (title.includes('audio') || title.includes('copyright') || title.includes('errata')) return false
  if (subjects.includes('periodicals') || shelves.includes('periodicals')) return false
  if (subjects.includes('catalog')) return false
  return true
}

function candidateUrls(id) {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}-0.txt`,
  ]
}

function stripGutenbergBoilerplate(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const startPatterns = [
    /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
    /\*\*\*\s*START OF THIS PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
  ]
  const endPatterns = [
    /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i,
    /End of (?:the )?Project Gutenberg(?:'s)? [\s\S]*$/i,
  ]
  let body = normalized
  for (const pattern of startPatterns) {
    const match = pattern.exec(body)
    if (match) {
      body = body.slice(match.index + match[0].length)
      break
    }
  }
  for (const pattern of endPatterns) {
    const match = pattern.exec(body)
    if (match) {
      body = body.slice(0, match.index)
      break
    }
  }
  return body
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function wordCount(text) {
  return text.match(/[A-Za-z][A-Za-z'-]+/g)?.length ?? 0
}

async function mapLimit(items, limit, worker) {
  const results = []
  let nextIndex = 0
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: limit }, run))
  return results
}

async function acquireRecord(record) {
  const id = record['Text#']
  const rawPath = join(rawDir, `pg-${id}.txt`)
  const cleanPath = join(cleanDir, `pg-${id}.txt`)
  let sourceUrl = null
  let error = null

  for (const url of candidateUrls(id)) {
    try {
      await downloadFile(url, rawPath, { retries: 2 })
      sourceUrl = url
      break
    } catch (candidateError) {
      error = candidateError
    }
  }
  if (!sourceUrl) {
    return { status: 'download_failed', id, reason: error?.message ?? 'no text URL succeeded' }
  }

  const rawText = readFileSync(rawPath, 'utf8')
  const cleanText = stripGutenbergBoilerplate(rawText)
  const words = wordCount(cleanText)
  if (words < minWords) {
    return { status: 'excluded', id, reason: `too_short:${words}`, sourceUrl, rawPath }
  }
  writeFileSync(cleanPath, `${cleanText}\n`)
  return {
    status: 'ready',
    work_id: `pg-${id}`,
    gutenberg_id: Number(id),
    title: record.Title,
    author: record.Authors,
    language: record.Language,
    subjects: record.Subjects,
    bookshelves: record.Bookshelves,
    issued: record.Issued,
    source_url: sourceUrl,
    raw_path: rawPath,
    cleaned_path: cleanPath,
    raw_bytes: statSync(rawPath).size,
    cleaned_bytes: statSync(cleanPath).size,
    word_count: words,
  }
}

async function main() {
  ensureDirs()
  await ensureCatalog()
  const records = catalogRecords().filter(isLikelyBook).slice(0, maxScan)
  const readyExisting = []
  const pending = []
  for (const record of records) {
    const id = record['Text#']
    const cleanPath = join(cleanDir, `pg-${id}.txt`)
    const rawPath = join(rawDir, `pg-${id}.txt`)
    if (existsSync(cleanPath) && wordCount(readFileSync(cleanPath, 'utf8')) >= minWords) {
      readyExisting.push({
        status: 'ready',
        work_id: `pg-${id}`,
        gutenberg_id: Number(id),
        title: record.Title,
        author: record.Authors,
        language: record.Language,
        subjects: record.Subjects,
        bookshelves: record.Bookshelves,
        issued: record.Issued,
        source_url: candidateUrls(id)[0],
        raw_path: rawPath,
        cleaned_path: cleanPath,
        raw_bytes: existsSync(rawPath) ? statSync(rawPath).size : 0,
        cleaned_bytes: statSync(cleanPath).size,
        word_count: wordCount(readFileSync(cleanPath, 'utf8')),
      })
    } else {
      pending.push(record)
    }
    if (readyExisting.length >= target) break
  }

  const acquired = [...readyExisting]
  const exclusions = []
  await mapLimit(pending, concurrency, async (record, index) => {
    if (acquired.length >= target) return null
    const result = await acquireRecord(record)
    if (result.status === 'ready') {
      acquired.push(result)
      if (acquired.length % 100 === 0) {
        console.log(`ready=${acquired.length} scanned=${readyExisting.length + index + 1}`)
      }
    } else {
      exclusions.push(result)
    }
    return result
  })

  const works = acquired.slice(0, target)
  writeFileSync(inventoryPath, works.map((record) => JSON.stringify(record)).join('\n') + '\n')
  writeFileSync(exclusionsPath, exclusions.map((record) => JSON.stringify(record)).join('\n') + '\n')
  const manifest = {
    generated_at: new Date().toISOString(),
    source: 'Project Gutenberg',
    catalog_url: catalogUrl,
    target_works: target,
    usable_works: works.length,
    scanned_catalog_records: records.length,
    exclusions: exclusions.length,
    raw_dir: rawDir,
    clean_dir: cleanDir,
    inventory_path: inventoryPath,
    exclusions_path: exclusionsPath,
    min_words: minWords,
    chunking_version: chunkingVersion,
    total_cleaned_bytes: works.reduce((sum, work) => sum + work.cleaned_bytes, 0),
    total_words: works.reduce((sum, work) => sum + work.word_count, 0),
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify(manifest, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
