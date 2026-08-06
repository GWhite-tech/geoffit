# ingest_runs.diagnostics_json

Added in `20260806150000_ingest_runs_diagnostics_json.sql`.

## Purpose

Persist production-grade blood (and future) parser stage diagnostics on each ingest run without mixing them into operational `stats` (attempt, fingerprint, fact counts).

## Shape (blood_lab_pdf)

```json
{
  "parser_name": "blood_lab_pdf",
  "parser_version": "1.0.0",
  "provider_detected": "Numan",
  "page_count": 5,
  "chars_per_page": [2808, 785, 2719, 4655, 4655],
  "total_characters": 15630,
  "biomarkers_found": 41,
  "failed_stage": null,
  "warnings": [],
  "document_class": "digital_selectable",
  "ocr_required": false,
  "stages": { "...": "full stage diagnostics" },
  "structured_log": { "...": "extract summary" }
}
```

Written by `processIngestRun` via `updateIngestRun({ diagnosticsJson })` from `ParseResult.diagnostics`.
