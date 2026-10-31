# TX-04: Look-ahead guard for model-scored text

**System:** S1 (research) · **Week:** W45 · **Depends on:** nothing

## Goal
No model score on text can pose as evidence for a period the model may already "know"
about. This is enforced in the data, not left to memory.

## Why
A large language model trained on data up to date X may have seen what happened after a
2024 statement. Scoring that statement in a backtest leaks the future. Studies show
look-ahead propensity is high in-sample and falls to near zero only after the cutoff
(arXiv 2512.23847). Encoder classifiers carry less risk but are not risk-free, because
their labels came from someone reading text in hindsight.

## Steps
1. Add a registry, `ext.text_model`:
   - `model`, `model_version`, `kind` (`encoder` | `llm` | `lexicon`)
   - `training_cutoff_utc`, `source_of_cutoff` (model card URL)
   - `licence`
2. Add `model_cutoff_utc` to `ext.doc_score`, filled from the registry at insert time.
3. Add `src/research/pit.py::clean_doc_scores(model)`. It returns only rows whose
   document `published_at` is later than the model's cutoff when kind = llm. For encoders
   and lexicons it returns every row, with a `pre_cutoff` flag on rows published before
   the cutoff, so a report can show both views. Every backtest and every
   bake-off (TX-01) reads through it.
4. Add a test that a pre-cutoff LLM score is excluded, and a CI-style check in
   `src/research/validate.py` that fails if any strategy reads `ext.doc_score` directly.
5. Add a note to the hypothesis card template in `lab/edge-research/`: text cards must
   state the model cutoff and the clean evaluation window.

## Acceptance
- The registry is seeded for FinBERT, the lexicon and the TX-01 candidates.
- The guard is used by `strategies.py` text strategies.
- Tests pass.
