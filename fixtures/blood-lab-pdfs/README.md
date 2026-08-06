# Blood lab PDF fixtures

Provider-agnostic regression fixtures for the staged blood PDF parser.

## Layout

```
fixtures/blood-lab-pdfs/<provider>/
  report.pdf           # Anonymised real PDF (required for CI)
  expectations.json    # Assertions (required for CI)
```

Discovered automatically by `pnpm test:blood-pdf`. Adding Medichecks, Randox, NHS, or Optimale only requires a new folder — no framework changes.

## Numan

Place the **real anonymised** Numan PDF at:

`fixtures/blood-lab-pdfs/numan/report.pdf`

Then update `expectations.json` if dates/values differ from the committed assertions.

> Until the real anonymised export is committed, the checked-in `report.pdf` is a digital Numan-shaped stand-in used to keep the harness green. Replace it with the anonymised production PDF as soon as available.

## expectations.json schema

See `lib/importers/blood-tests/pipeline/fixture-contract.ts`.

## Anonymisation checklist

- Remove patient name / DOB / address / NHS number / email / phone
- Keep biomarker table, units, flags, and test date (or synthetic date)
- Do not commit PHI
