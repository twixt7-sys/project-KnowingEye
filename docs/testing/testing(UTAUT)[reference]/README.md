# OSAS WBSMS — UTAUT Testing Pack

Structured data and tooling for **Chapter 7 §§7.6–7.8** (UTAUT framework, survey instrument, data analysis), based on [UTAUT chap 7.pdf](../overview/documents/UTAUT%20chap%207.pdf) and adapted for the **Web-Based Student Management System** at Legacy College of Compostela.

Functional test cases (7.1–7.5) live in [`docs/testing/`](../testing/).

## Folder layout

| Path | Purpose |
|------|---------|
| `framework-data/` | UTAUT theory, Likert legend, analysis methods |
| `instrument-data/` | 25-item survey + links to official OSAS questionnaires |
| `respondent-data/` | Table 7.7 respondent profile, sampling plan (target n = 50; collected n = 46) |
| `chapter-data/` | Thesis-ready JSON for §7.6, 7.7, 7.8 |
| `results-data/` | Raw Likert encoding, computed stats, Pearson r |
| `scripts/` | Bootstrap, compute, sync, generate Word/Excel |
| `documents/` | Generated outputs |

## Quick start

```bash
# 1. Generate / refresh JSON pack
python "docs/testing(UTAUT)/scripts/bootstrap_utaut_content.py"

# 2. Encode survey results in results-data/raw_responses.json
#    (or use documents/LCC_OSAS_WBSMS_UTAUT_RawResponsesTemplate.xlsx)

# 3a. Compute from frequency tallies (UTAUT results.png)
python "docs/testing(UTAUT)/scripts/compute_from_frequency_tables.py"

# 3b. Or compute from encoded individual responses
python "docs/testing(UTAUT)/scripts/compute_utaut_statistics.py"

# 4. Push stats into chapter-data
python "docs/testing(UTAUT)/scripts/sync_results_to_chapter_data.py"

# 5. Generate Word / Excel
pip install python-docx openpyxl
python "docs/testing(UTAUT)/scripts/generate_documents.py"
```

## UTAUT constructs (25 items)

| Code | Items | Construct |
|------|-------|-----------|
| PE | 1–5 | Performance Expectancy |
| EE | 6–10 | Effort Expectancy |
| SI | 11–15 | Social Influence |
| FC | 16–20 | Facilitating Conditions |
| BI | 21–25 | Behavioral Intention |

## Related files

- Thesis chapter JSON: [`OSAS_chapters_7_10_content.json`](../overview/documents/OSAS_chapters_7_10_content.json)
- Official forms: `OSAS_sys_Questionnaire(student).docx`, `OSAS_sys_Questionnaire(admin).docx`
- Functional testing: [`docs/testing/`](../testing/)

## Data status

`results-data/computed_*.json` ships with **illustrative values** from UTAUT chap 7.pdf. Replace by encoding real responses and running `compute_utaut_statistics.py` before final submission.
