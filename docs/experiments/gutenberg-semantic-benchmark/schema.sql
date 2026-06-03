CREATE TABLE works (
  work_id TEXT PRIMARY KEY,
  gutenberg_id INTEGER,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER,
  language TEXT NOT NULL,
  subjects TEXT NOT NULL,
  text_path TEXT NOT NULL
);

CREATE TABLE passages (
  passage_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(work_id),
  chapter_id TEXT NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  chunking_version TEXT NOT NULL
);

CREATE TABLE task_items (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,
  query TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  expected_output_json TEXT NOT NULL,
  rubric_json TEXT NOT NULL
);

CREATE TABLE gold_labels (
  task_id TEXT NOT NULL REFERENCES task_items(id),
  passage_id TEXT NOT NULL REFERENCES passages(passage_id),
  label TEXT NOT NULL CHECK (label IN ('positive', 'hard_negative', 'ambiguous', 'out_of_scope')),
  relevance INTEGER NOT NULL CHECK (relevance BETWEEN 0 AND 3),
  rationale TEXT NOT NULL,
  adjudication_status TEXT NOT NULL DEFAULT 'pilot',
  PRIMARY KEY (task_id, passage_id)
);

CREATE TABLE baseline_results (
  run_id TEXT NOT NULL,
  task_id TEXT NOT NULL REFERENCES task_items(id),
  baseline TEXT NOT NULL,
  rank INTEGER NOT NULL,
  passage_id TEXT NOT NULL REFERENCES passages(passage_id),
  score REAL NOT NULL,
  PRIMARY KEY (run_id, task_id, baseline, rank)
);
