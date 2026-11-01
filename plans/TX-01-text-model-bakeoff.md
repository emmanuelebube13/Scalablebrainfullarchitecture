# TX-01: Text-model bake-off, FinBERT vs alternatives vs LLM

**System:** S1 (nlp) · **Week:** W46 · **Depends on:** TX-04 (look-ahead guard), owner decision D6

## Goal
Choose the text scorer for central-bank communication on evidence, and record how it
compares with what we use now (ProsusAI FinBERT).

## Why
FinBERT was recommended to the owner, but:
- It was trained on equity news (Financial PhraseBank).
- On FX headlines it scored 0.56 against an LLM's 0.79 (Fatouros et al., arXiv
  2308.07935).
- Headline sentiment doesn't forecast FX direction at our speed.

Text is worth testing only on central-bank statements, minutes and pressers, the input
behind the December lead `fomc_tone_lexicon`. Domain models built for that text exist
now.

## Candidates
| model | what it is | licence / cost | note |
|---|---|---|---|
| `ProsusAI/finbert` | current; positive/negative/neutral on equity news | Apache-2.0 | baseline |
| `yiyanghkust/finbert-tone` | FinBERT fine-tuned on analyst-report tone | check card | second baseline |
| `Moritz-Pfeifer/CentralBankRoBERTa-sentiment-classifier` | RoBERTa on 12k labelled Fed/ECB/BIS sentences (J. Finance & Data Science 2023) | check card | built for central banks, plus an agent classifier |
| `gtfintechlab/FOMC-RoBERTa` | RoBERTa-large, hawkish/dovish/neutral, "Trillion Dollar Words" (ACL 2023) | **CC BY-NC 4.0** | research-only unless D6 allows |
| Claude (Haiku/Sonnet, latest) via API | zero-shot hawkish/dovish, prompt names the currency | metered | look-ahead risk before its training cutoff (TX-04) |
| lexicon (current `fomc_tone_lexicon`) | rule-based | free | what the December card actually trades |

The encoder models download as weights through `transformers`, which is installed. They
add no new DLLs. Call the API through `requests`, because the `anthropic` package is not
installed. Keep the API key in `C:\SB\secrets\`, never in the repo.

## Steps
1. **Labelled set.** Use the Trillion Dollar Words annotated FOMC sentences (GitHub
   `gtfintechlab/fomc-hawkish-dovish`, with its train/test splits). Check its licence; if
   it is non-commercial, use it for evaluation only. Add 100 recent sentences (2025–2026,
   after the LLM cutoff) labelled by the owner or a second LLM pass. Disagreements get a
   human tie-break.
2. **Label accuracy.** Run every candidate on the test split.
   - Report accuracy and macro-F1 with bootstrap CIs.
   - Map FinBERT's positive/negative to hawkish/dovish explicitly and record the mapping.
3. **Market relevance**, the test that matters.
   - For each FOMC statement in `ext.document`, take the document-level tone (mean of
     sentence scores).
   - Correlate it with USD-pair returns from release+60m to +1d and +10d, the hold in
     card H-20261018-14.
   - **LLM rows count only for statements after the model's cutoff.**
   - Report n honestly. It will be small, about 8 statements a year.
4. **Cost and latency.** Measure per statement on CPU and on GPU (torch CUDA is
   available), and the API cost per statement.
5. **Write scores** to `ext.doc_score` with `model`, `model_version` and
   `model_cutoff_utc` (TX-04).
6. **Choice rule, written into the report before step 3 is run:**
   - Prefer the best label accuracy among models that are free to use under the
     licence decision.
   - An LLM is chosen only if it beats the best encoder by > 5 points of macro-F1.
7. **Wire the winner**, plus the lexicon, as evidence sources `tone_<model>` (PC-01).
   Keep FinBERT logging as a baseline for 8 weeks, then drop it if it adds nothing.
8. **Report** at `results/research/text_bakeoff/<date>.md`.

## Acceptance
- The report has both tables (label accuracy and market relevance).
- The choice is made by the pre-written rule.
- The source is wired in DEV.

## Guardrails
Text never gates a trade. A tone score that conflicts with a trade is advice (TX-03) or
an evidence row. Its weight is earned in PC-05.

---

## Result: 2026-11-01 (Gemini draft, Claude-reviewed; dev brain `333ba75`, `219966a`)

**Ran on real data. The decision is provisional until two candidates run.**
- **Code:** `src/research/text_bakeoff.py`, `text_scorers.py`, `src/evidence/sources_tone.py`.
- **Report:** `results/research/text_bakeoff/2026-11-01-bakeoff-v1.md`.
- **Labelled set:** 476 sentences from the "Trillion Dollar Words" FOMC test split (seed
  5768), converted to `C:\SB\lab\data\fomc-hawkish-dovish\fomc_labels_test.csv`.

| Model | Macro-F1 (95% CI) | Spearman vs USD move, +1d / +10d |
|---|---|---|
| **yiyanghkust/finbert-tone** (winner by rule) | 0.467 [0.420, 0.512] | 0.015 / 0.049 (both CIs span 0) |
| ProsusAI/finbert (baseline) | 0.457 [0.412, 0.501] | −0.044 / −0.006 (both span 0) |
| CentralBankRoBERTa (binary, no neutral) | 0.260 [0.228, 0.293] | 0.094 / 0.051 (both span 0) |

**What it means:**
- FinBERT-tone and FinBERT are tied within noise.
- **No model's tone predicts the dollar's move** across 177 FOMC statements with price
  history. 13 earlier statements predate the 2006 bars and were dropped and counted.
- Both are now logged as evidence sources (`tone_finbert_tone`, `tone_finbert`) so PC-05
  can weight them on forward data.

**Not evaluated:**
- `gtfintechlab/FOMC-RoBERTa`: gated on Hugging Face. The owner must accept its terms and
  log in (`huggingface-cli login`).
- Claude: no `ANTHROPIC_API_KEY`.

These are the two stance models, so rerun when they are available.

**Review notes on Gemini's draft (all fixed before the numbers):**
- An injected model skipped its label map, so every sentence scored neutral.
- `time` was not imported.
- The `finbert-tone` loader needed BERT classes.
- Missing prices turned every correlation into NaN.
- n < 2 printed as 0.0.
- Claude prices were hard-coded.
- A gated model crashed the run.

The licences and label maps were then checked on the model cards and the registry
corrected: CentralBankRoBERTa is MIT; finbert-tone states no licence.
