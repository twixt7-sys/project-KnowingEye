# Knowing Eye - UTAUT Testing Pack

Structured data for **Chapter 7 §§7.6–7.8** (UTAUT framework, survey, analysis), adapted for the **Knowing Eye** proctored examination platform.

Functional IEEE testing: [`docs/testing/testing(IEEE)/`](../testing(IEEE)/).  
Frozen OSAS reference: [`misc/archive/osas-utaut-reference/`](../../../misc/archive/osas-utaut-reference/).

## Quick start

```bash
python docs/testing/testing(UTAUT)/scripts/bootstrap_knowing_eye_utaut.py
# Encode responses in results-data/raw_responses.json
python docs/testing/testing(UTAUT)/scripts/compute_utaut_statistics.py
python docs/testing/testing(UTAUT)/scripts/sync_results_to_chapter_data.py
pip install python-docx openpyxl
python docs/testing/testing(UTAUT)/scripts/generate_documents.py
```

## UTAUT constructs (25 items)

Survey items evaluate acceptance of **webcam-monitored online examinations** (performance expectancy, effort expectancy, social influence, facilitating conditions, behavioral intention).

| Code | Items | Construct |
|------|-------|-----------|
| PE | 1–5 | Performance Expectancy |
| EE | 6–10 | Effort Expectancy |
| SI | 11–15 | Social Influence |
| FC | 16–20 | Facilitating Conditions |
| BI | 21–25 | Behavioral Intention |

## Respondents

Target: institution staff (examiners/administrators) and examinees who used the Knowing Eye prototype in UAT.
