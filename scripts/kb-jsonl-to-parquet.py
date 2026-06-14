#!/usr/bin/env python3
"""Write KB JSONL rows to Parquet with a stable string schema."""

import argparse
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--columns", required=True)
    args = parser.parse_args()

    columns = [column for column in args.columns.split(",") if column]
    rows = []
    input_path = Path(args.input)
    if input_path.exists():
        with input_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    rows.append(json.loads(line))

    arrays = {}
    for column in columns:
        arrays[column] = pa.array([normalize_value(row.get(column)) for row in rows], type=pa.string())

    table = pa.table(arrays, schema=pa.schema([(column, pa.string()) for column in columns]))
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, output_path)


def normalize_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


if __name__ == "__main__":
    main()
