import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const root = process.cwd()
export const experimentDir = join(root, 'docs/experiments/gutenberg-semantic-benchmark')
export const dataDir = join(experimentDir, 'data')
export const localCorpusDir = join(experimentDir, '.local/corpus')
export const inventoryPath = join(localCorpusDir, 'source-inventory.jsonl')
export const taskPath = join(dataDir, 'task_items.jsonl')
export const highRecallDir = join(experimentDir, 'high_recall')

export const stopwords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the', 'their', 'they', 'this', 'to',
  'was', 'were', 'where', 'with', 'you', 'your', 'but', 'not', 'had', 'all', 'one', 'there',
])

export const semanticLexicon = {
  death: ['death', 'dead', 'died', 'dying', 'funeral', 'coffin', 'grave', 'burial', 'corpse', 'widow', 'mourning', 'loss', 'undertaker', 'deathbed'],
  humor: ['joke', 'jest', 'laugh', 'smile', 'comic', 'funny', 'wit', 'irony', 'dry', 'understated', 'quip', 'absurd', 'mock', 'merry'],
  coping: ['cope', 'coping', 'managed', 'arranged', 'kept', 'steady', 'steadied', 'composed', 'deflect', 'relief', 'endure', 'bear', 'courage'],
  inward: ['quiet', 'tired', 'weary', 'rain', 'home', 'inward', 'mellow', 'hopeless', 'grey', 'resigned', 'lonely', 'twilight'],
  criticism: ['scold', 'criticized', 'fault', 'foolish', 'care', 'dear', 'protect', 'affection', 'rebuke', 'chide', 'reproach'],
  class: ['poor', 'poverty', 'rank', 'money', 'respectable', 'parlor', 'house', 'status', 'shabby', 'embarrassed', 'gentility', 'servant'],
  irony: ['irony', 'solemn', 'grand', 'absurd', 'dignity', 'vanity', 'bathos', 'narrator', 'self-image', 'ridiculous'],
  religion: ['god', 'soul', 'spirit', 'spiritual', 'sin', 'heaven', 'providence', 'prayer', 'faith', 'moral', 'decay', 'progress'],
  empire: ['empire', 'imperial', 'colony', 'conquest', 'destiny', 'civilization', 'savage', 'frontier', 'rule', 'race', 'flag'],
  domestic: ['home', 'room', 'house', 'door', 'bed', 'nursery', 'kitchen', 'chamber', 'domestic', 'parlor', 'hearth'],
  gothic: ['dark', 'dread', 'terror', 'castle', 'secret', 'shadow', 'haunted', 'gloom', 'fear', 'corridor', 'ruin'],
}

export const seededHints = {
  death_ironic_humor_001: {
    authors: ['twain', 'sterne', 'dickens', 'shakespeare', 'swift', 'corelli'],
    titles: ['tristram', 'huckleberry', 'pickwick', 'hamlet', 'tale of two cities'],
    terms: ['gallows humor', 'deathbed jest', 'funeral joke', 'grave wit', 'dry remark about death'],
  },
  rainy_commute_vibe_001: {
    authors: ['galsworthy', 'hardy', 'wharton', 'lawrence', 'woolf', 'dickens'],
    titles: ['beyond', 'ethan frome', 'sons and lovers'],
    terms: ['rain', 'station', 'street', 'weary', 'grey', 'home', 'tired walk'],
  },
  affection_as_criticism_001: {
    authors: ['austen', 'gaskell', 'alcott', 'dickens', 'eliot'],
    titles: ['pride and prejudice', 'emma', 'little women', 'mary barton'],
    terms: ['scolded because she loved', 'chided affectionately', 'dear fool', 'rebuke with care'],
  },
  class_anxiety_place_001: {
    authors: ['austen', 'dickens', 'gaskell', 'wharton', 'thackeray'],
    titles: ['great expectations', 'vanity fair', 'house of mirth', 'north and south'],
    terms: ['shabby room', 'respectable poverty', 'poor lodging', 'parlor embarrassment'],
  },
  progress_as_decay_001: {
    authors: ['ruskin', 'carlyle', 'morris', 'chesterton', 'butler'],
    titles: ['news from nowhere', 'past and present', 'heretics'],
    terms: ['progress spiritual decay', 'machine soul', 'industrial sin', 'modern decay'],
  },
  narrator_undercuts_self_image_001: {
    authors: ['austen', 'thackeray', 'fielding', 'dickens', 'chesterton'],
    titles: ['vanity fair', 'tom jones', 'emma', 'pride and prejudice'],
    terms: ['vanity', 'dignity', 'ridiculous', 'solemnly absurd', 'comic self-importance'],
  },
  domestic_space_threatening_001: {
    authors: ['gaskell', 'bronte', 'wharton', 'wells', 'stoker'],
    titles: ['jane eyre', 'wuthering heights', 'the turn of the screw', 'lodger'],
    terms: ['threatening room', 'unsafe home', 'dark chamber', 'locked door'],
  },
  resignation_not_despair_001: {
    authors: ['dickens', 'hardy', 'eliot', 'gaskell', 'tolstoy'],
    titles: ['tale of two cities', 'silas marner', 'jude the obscure'],
    terms: ['calm resignation', 'accepted suffering', 'endured quietly', 'not despair'],
  },
  gothic_without_supernatural_001: {
    authors: ['radcliffe', 'bronte', 'poe', 'hawthorne', 'stoker'],
    titles: ['udolpho', 'jane eyre', 'house of the seven gables'],
    terms: ['gothic dread', 'dark corridor', 'secret room', 'no ghost'],
  },
  empire_as_destiny_001: {
    authors: ['kipling', 'haggard', 'stevenson', 'conrad', 'buchan'],
    titles: ['king solomon', 'kim', 'prester john', 'heart of darkness'],
    terms: ['empire destiny', 'imperial destiny', 'civilizing mission', 'frontier rule'],
  },
}

export function valueForArg(name, fallback = null) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return raw ? raw.slice(name.length + 1) : fallback
}

export function hasFlag(name) {
  return process.argv.includes(name)
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

export function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

export function appendJsonl(path, row) {
  appendFileSync(path, `${JSON.stringify(row)}\n`)
}

export function tokenize(text) {
  return text.toLowerCase().match(/[a-z][a-z'-]+/g)?.filter((token) => !stopwords.has(token)) ?? []
}

export function chunkText(text, targetWords = 600, overlapWords = 100) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const words = normalized.split(' ').filter(Boolean)
  const chunks = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(words.length, start + targetWords)
    chunks.push(words.slice(start, end).join(' '))
    if (end === words.length) break
    start = Math.max(start + 1, end - overlapWords)
  }
  return chunks
}

export function taskSignals(task) {
  const query = task.query.toLowerCase()
  if (query.includes('death') && (query.includes('humor') || query.includes('dry') || query.includes('ironic'))) {
    return [
      { name: 'death', words: semanticLexicon.death },
      { name: 'humor', words: semanticLexicon.humor },
      { name: 'coping', words: semanticLexicon.coping },
    ]
  }
  const signals = []
  for (const [name, words] of Object.entries(semanticLexicon)) {
    if (query.includes(name) || words.some((word) => query.includes(word))) signals.push({ name, words })
  }
  return signals.length ? signals.slice(0, 4) : [{ name: 'query_terms', words: tokenize(task.query).slice(0, 12) }]
}

export function candidateId(taskId, passageId) {
  return `${taskId}:${passageId}`
}

export function stableRunId(prefix) {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`
}
