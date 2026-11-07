# Integration plan

## 1. Instrument master

Use one instrument resolver for stock pages, Analytics, AI Studio, screener and paper orders. Import the entitled NSE instrument master with provider IDs, active status, exchange, symbol, series where relevant, and effective-dated aliases. Audit why MRF appears in quick select while resolution fails. Quick picks should be backed by actual master records, with explicit availability if provider coverage is missing. Use canonical instrument IDs throughout. Distinguish unknown ticker, known ticker with no data, and master unavailable. Reject unknown symbols before forecast, report or order actions. Keep strict serialization and return a typed unavailable error for a missing required indicator. A fixture entry for MRF only verifies the resolver.

## 2. Reports and frontend state

Use one bounded server report service for stock and Terminal, tied to a verified forecast ID and canonical symbol. Configure server-side secrets and provider timeouts, and map known provider failures to the structured fallback. Supply only validated facts. Validate any optional generated text before display, with particular care for new numbers or news claims. Prefer structured output and plain text. Label the source. Set the browser deadline above the server response budget and show Retry on failure. Use request identity to clear stale report, forecast and trade state. Build the response key from returned identifiers before rendering. Call clear on selection changes and route cleanup.

## 3. Screener

Serve a paginated, filtered snapshot from scheduled bulk ingestion or an entitled bulk endpoint. Avoid blocking the browser on a request per instrument. Return source, as-of and completeness. Distinguish valid zero matches from missing feed, stale snapshot, rate limit and timeout. Add a retry action and bounded upstream I/O. On outage, label a permitted last-good snapshot stale and show its timestamp. Keep synthetic prices out of production.

## 4. Quote consistency and paper execution

Distinguish current quote, forecast reference close and simulated fill quote. The stock header and order preview should use the same quote identity for the same instrument and snapshot. If the forecast used an earlier close, label it with source and timestamp. The observed RELIANCE values were ₹1,320.00 in the header and ₹1,313.40 on the order button. Diagnose the actual source and timestamps before changing either. At submission, the server verifies the preview quote ID and freshness. If the price changes, require a refreshed preview. Use a decimal or integer minor-unit amount and transactional, idempotent ledger writes. The reference guard assumes a fresh live quote. If the product supports after-hours paper execution, define a separate explicit simulation rule and label it. Keep execution virtual.

## 5. Staging acceptance

| Check | Pass condition |
|---|---|
| TCS, RELIANCE, INFY | Each forecast renders for the correct stock with finite values or gives a specific abstention reason. |
| MRF and fake ticker | MRF resolves to the authoritative master record and returns a forecast or a specific data-coverage error. ZZZINVALIDTEST is rejected with no price, report or trade. |
| Switching | Force slow INFY and fast MRF responses. Only the current selection can render and enable a simulated action. |
| AI reports | Stock and Terminal each return within the configured deadline. Simulated provider failure returns a labeled structured fallback or a clear reason no verified facts were available. |
| Screener | An entitled data snapshot shows genuine rows. An empty filter shows zero matches. Timeout and stale states are visibly different. |
| Quote and ledger | Compare quote IDs, timestamps, source and values. Test expired quote rejection, repeated request idempotency and cash/holdings reconciliation for a simulated buy and sell. |
| Model validation | Report versioned data and model, chronological holdout and baselines. Separate model output rendering from accuracy claims. See ORIGINAL-PLAN.md. |

Keep test fixtures isolated. Record environment, commit, test input, result, and evidence for every staged check. Leave unresolved rights or provider dependencies visibly blocked.
