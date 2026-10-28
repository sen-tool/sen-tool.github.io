# Homepage audit and record matching fixes

Goal: fix confirmed OCR/export/matching defects and audit every tool without changing payment or education policy rules.

Scope authorized by the user: proceed with needed fixes and review the whole homepage. Use the existing standalone HTML architecture. Work on a separate branch from latest main; test changed tools with samples; create and merge a PR as required by CLAUDE.md.

## Tasks
- [x] 1. Add regression tests for OCR missing keywords, two-digit years, manual override conflicts, copying/export, re-recognition, and home sample navigation.
- [x] 2. Fix record-photo validation, preserve intentional overrides with visible conflicts/reset, warn before replacing edited OCR rows, and clarify XLSX transfer and row limits.
- [x] 3. Fix both workbook directions to reject incomplete matches and normalize four-digit years; label candidate counts clearly and explain candidate-level identity limits. Preserve native workbook formatting/validation.
- [x] 4. Audit all HTML syntax, local assets, navigation, samples, downloads, mobile overflow, and external-service boundaries. Fix confirmed home sample race/timeout and missing bundled record template.
- [ ] 5. Regressions, browser samples and independent review passed; commit/publish/hosting verification pending.

## Decisions
- Do not guess OCR letters or a century for two-digit years. Flag unresolved years for review.
- Keep manual overrides, visibly warn when title parsing disagrees, and provide an explicit reset.
- Keep existing school/keyword matching semantics; explain that matches are candidates rather than a unique physical identifier. No automatic disposal decisions.
- Financial and legal rule correctness requires separate source-backed validation; this audit tests software behavior and sample execution.
- Fixed workbook capacity remains 1,000 physical rows/3,000 holdings; add explicit warnings rather than silently implying unlimited capacity.

## Review focus
Blank keywords/years must never confirm presence; invalid input must remain visible in summaries. Copy and XLSX must preserve column placement. Editing must not silently erase manual values. Sample jobs must stop on navigation or timeout. Examples must not overwrite user's existing OCR work without confirmation.
