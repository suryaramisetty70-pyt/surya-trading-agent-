# MAX MARKET implementation plan

**Objective** Build a reliable market research and paper-trading application with a measurable hybrid ML forecast. Preserve the existing site and work in phases.  
**Prepared** 7 November 2026  
**Planning assumptions** NSE cash equities first, daily bars, 1/5/20 trading-session horizons, private staging, and virtual orders. Reuse the existing application stack and Render deployment where practical. Provider, budget, and publication rights are owner decisions.

## 1. Repair the failures already seen on the deployed site

| Priority | Reproduction from the live review | Required result |
|---|---|---|
| P0 | Run a stock forecast for RELIANCE or TCS, or an Analytics forecast for TCS or INFY. The browser rejected a response containing `"atr_14":NaN`. Live stock data for TCS and RELIANCE also contained bare `NaN`. | Identify where missing or invalid bars enter the pipeline. Validate bars before features and reject non-finite required inputs and outputs. Use strict JSON serialization at every response boundary. Optional missing values may be JSON `null`. Required missing values produce a typed unavailable response. |
| P0 | Run `ZZZINVALIDTEST` in Analytics. The site returned STRONG SHORT at ₹1,000 and offered a virtual order. | Resolve all inputs against the authoritative instrument master. Unknown symbol produces `404 UNKNOWN_SYMBOL` before forecast, explanation or execution. Remove default prices, synthetic production candles, and generic instrument objects that look like valid securities. |
| P0 | Select MRF after the invalid-symbol request. The old explanation remained visible. | Clear output and disable execution on symbol change. Cancel previous requests where possible and ignore late results. Require instrument ID, horizon and request identity to match the current view before rendering results. Apply the same rules to charts and explanations. |
| P1 | Stock AI report and Terminal AI Studio showed AI server connection errors. | Trace backend logs and distinguish missing credentials, rate limits, timeout and provider failures. Keep credentials server-side. Show a structured explanation generated from forecast fields when the optional AI explainer fails. Label the explanation source. |
| P1 | All Equities showed zero rows and the refresh control was disabled when checked. | Separate loading, valid empty results, failed feed, and unavailable entitlement. Recover from timeout and make retry available. |
| P1 | A virtual TCS buy and sell succeeded and both appeared as filled. | Preserve this flow and add idempotency, quote checks, atomic wallet updates and replayable ledger tests. |

RFC 8259 excludes NaN and Infinity from JSON. Returning zero for an undefined ATR would change the model input and can generate misleading forecasts. [RFC 8259, section 6](https://www.rfc-editor.org/rfc/rfc8259#section-6)

## 2. Market data and launch dependencies

| Dependency | What the application needs |
|---|---|
| Source repository and staging | Frontend, backend, package manifests, model artifacts or training code, migrations, CI, deployment config and sanitized error logs. Use a staging environment and separate database. |
| NSE market data | Select NSE Data & Analytics or a currently authorized vendor with written rights for the intended audience. Ask for written terms covering public display, storage, history, caching, model training, derived outputs and redistribution. Verify each entitlement separately. Get sample payloads, timestamps, symbols, coverage, rate limits, support and pricing before choosing. |
| Reference data | Instrument master with stable internal IDs, exchange and segment, vendor mapping, effective-dated ticker aliases, listings and delistings. Use ISIN where available. Add trading calendar, special sessions, corporate actions, historical benchmark and point-in-time universe membership. |
| Hosting and operations | Database with backups, a scheduled ingestion and training job, versioned model storage, CI, health checks, monitoring and a rollback procedure. Reuse existing services first. Choose a worker or queue only when ingestion or request volume requires it. |
| Optional AI | A server-side provider account, secret store and budget. LLM use is optional. Forecast generation, explanations based on structured facts, and paper trading can run without it. |
| Public release | Verify data rights and obtain a qualified review of the planned forecasts, labels, alerts and publication model before exposing security-specific signals publicly. Leave those routes and features gated at the server until cleared. A disclaimer alone does not resolve the release decision. |

**Data promise.** Every displayed market value must trace to an approved source, instrument and timestamp, or be explicitly labeled as derived. Forecasts are estimates. Use licensed end-of-day or delayed data if live display rights are unavailable. Keep test fixtures confined to isolated test environments.

- Normalize currencies and units, preserve source and receipt timestamps in UTC, and display market times in IST. Use the exchange calendar for regular, special and closed sessions. A ticking clock does not prove the feed is live.
- Define statuses per field or dataset. Use Live for entitled, fresh intraday data, Delayed with its actual delay, End of Day with session date, Market Closed with last valid close, Stale with age, and Unavailable with a reason. Apply thresholds per product, session and provider. Show data as-of separately from page refresh time.
- Keep raw and adjusted bars distinct. Display raw traded prices for quotes and simulated execution. Use documented, point-in-time corporate-action adjustments for training. Do not mix adjusted training targets with raw displayed prices without a defined conversion.
- Validate instrument, timestamp order, currency, finite values, positive prices, OHLC consistency, nonnegative volume and duplicate keys. Quarantine malformed data. Backfill missing sessions with genuine records where available. Keep gaps explicit and prevent inference when required inputs or indicator warm-up are missing.
- Reconcile sampled quotes and historical bars to authorized reference snapshots with matching exchange, timestamp, units and adjustment status. Define tick-size or rounding tolerance per field. Log discrepancies and prevent publication beyond the agreed tolerance. Preserve revisions and input lineage.
- Inventory every value on Home, Stock, Terminal and Galaxy. For each card record provider, field, freshness, display entitlement and fallback behavior. Label fundamentals with reporting period and publication time, DCF and Greeks with assumptions, news with publisher and timestamp, and sentiment with methodology and as-of time. Hide or mark unconfigured indices, crypto, FX, options and other feeds unavailable. Remove sample balances, news, alerts and KYC badges from production views.

Sources [NSE real-time products](https://www.nseindia.com/static/market-data/real-time-data-subscription) · [NSE data use policy](https://www.nseindia.com/static/market-data/nse-data-policy) · [NSE trading calendar](https://www.nseindia.com/resources/exchange-communication-holidays) · [SEBI Research Analyst FAQs](https://www.sebi.gov.in/sebi_data/attachdocs/jul-2025/1753268710217.pdf)

## 3. Hybrid ML design and evidence

**Forecast definition.** At the final validated close for session t, forecast the 1-, 5- and 20-session adjusted close-to-close returns. Publish horizon dates from the exchange calendar and distinguish reference price from a possible execution price. Classify each horizon as Up, Neutral or Down using a documented threshold based on estimated costs and noise. Set the threshold during development and lock it before holdout evaluation. Backtest fills from the next tradable session after the prediction is available, accounting for execution costs separately from the prediction target.

| Component | Implementation |
|---|---|
| Baselines | Zero-return forecast, historical class frequencies and a simple momentum rule. Compare the hybrid against each baseline and its strongest individual component. |
| Trend model | Gradient-boosted trees for directional classes, with a logistic regression baseline for comparison. Inputs include lagged returns, moving-average distances, RSI, ATR, volatility, volume and relative market strength using only data available at prediction time. |
| Range model | Train quantile regressors per horizon for median and 10th/90th percentile returns. Track pinball loss and interval coverage. Check quantile ordering and disclose when coverage deteriorates. Convert to indicative price ranges using the declared price basis. |
| Mean reversion and regime | Use a testable z-score or Bollinger-band reversion component. Combine directional probabilities using weights learned from out-of-fold predictions. Use regime-dependent weights only where there is enough training evidence. Evaluate whether the component improves results before retaining it. |
| Calibration and abstention | Calibrate probabilities on temporally separate data. Return an abstention when history is insufficient, required data are stale, uncertainty is high, or a model version is unavailable. Label probabilities as estimated and avoid presenting confidence as accuracy. |
| Explanation | Generate structured explanations from model output and supported feature attribution. Optional LLM paraphrasing receives a validated snapshot tied to the forecast ID. Validate identifiers and numbers before display. If verification fails, use the structured explanation. |

**Validation protocol**

1. Build chronological folds grouped by date across instruments. Purge examples whose label windows overlap validation and leave a gap consistent with the longest horizon and source availability. Fit preprocessors, model weights and thresholds using training data only. Keep calibration, tuning and final holdout separate.
2. Use point-in-time membership, listing history and corporate action availability. Include delistings where historical coverage permits. Document any missing coverage, leakage checks, data snapshot, Git commit, seeds, configuration and model versions.
3. Report per-horizon sample size, confusion matrix, balanced accuracy or macro F1, Brier score and reliability plots, return MAE, pinball loss and interval coverage. Report abstention rate and results by liquidity and regime. Add uncertainty bands using resampling that preserves time dependence.
4. Backtest the signal policy using next-session execution, costs, slippage, liquidity limits and long-only cash-equity assumptions unless the simulator explicitly supports short mechanics. Report net returns, turnover and drawdown against relevant benchmarks. Separate trading performance from forecast metrics.
5. Approve numerical release thresholds before opening the holdout. Require out-of-sample improvement against the agreed baseline for the primary metrics, acceptable calibration and coverage, and enough samples at each released horizon. If a horizon fails, withhold it. Monitor drift, realized errors and data coverage after release. Promote retrained models only after evaluation and preserve a rollback version.

References [Time-series split and gap](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) · [Probability calibration](https://scikit-learn.org/stable/modules/calibration.html) · [LightGBM objectives](https://lightgbm.readthedocs.io/en/stable/Parameters.html)

## 4. Application, APIs and operations

- **Pipeline** Provider → validation and instrument resolution → raw and normalized storage → features → versioned model inference → quote/forecast APIs → Stock and Terminal. Schedule ingestion after bar finalization. Use idempotent jobs, bounded retries and visible ingestion lag.
- **API** Reuse existing routes and publish a typed contract. Quotes include instrument ID, symbol, exchange, currency, source, exchange timestamp, delay and status. Forecasts include forecast ID, instrument ID, as-of, input data and model versions, horizon dates, class probabilities, return quantiles and quality status. Provide a typed error with request ID, safe message and retry guidance. Distinguish unknown symbol, insufficient history, stale data, unavailable model, provider outage and rate limit. Validate at the serializer and consumer. For slow reports use a bounded timeout or status endpoint.
- **UI** Implement explicit idle, loading, ready, empty, abstained, stale and failed states. Keep selected instrument visible across the forecast, chart and explanation. Show timestamp and source beside values. Use keyboard-accessible controls and test narrow screens. Provide clear unavailable labels where features lack entitlement.
- **Paper orders** Use a vetted quote and explicit simulation fill rules. Reject stale prices, unsupported symbols, disallowed positions and insufficient funds. Use an idempotency key and a single database transaction for order, balance and holdings. Bind forecast-driven actions to a current forecast ID. Keep real orders, deposits, withdrawals and broker actions disabled for this scope.
- **Security and reliability** Keep secrets server-side, redact logs, scope authentication to user accounts, enforce ledger isolation and rate limit provider-backed endpoints. Track parse failures, unknown-symbol forecasts, feed freshness, model abstention and failures, stale responses, and API latency. Alert on unexpected data gaps and degraded providers. Use separate readiness and dependency diagnostics to avoid restarting the site during a vendor outage. Rehearse rollback and restore. [Render health checks](https://render.com/docs/health-checks)

## 5. Phases and acceptance tests

| Phase | Completion evidence |
|---|---|
| A · Stabilize | Baseline and root-cause notes, regression tests for strict JSON, invalid symbols, stale results and disabled actions. Tested timeout recovery and specific AI/screener states. |
| B · Verify market data | Provider and rights matrix, coverage and data lineage, end-to-end verified source reconciliation, session and stale-data tests. Production deployment blocked on missing entitlements for affected features. |
| C · Evaluate and integrate ML | Reproducible training and inference commands, versioned models, fold/holdout metrics and backtest report. UI shows actual calibrated outputs or a reason for abstention. |
| D · Stage and retest | CI green, staging URL, feature flags, verified error handling, operations checklist, rollback instructions and explicit pass/fail/blocked status. Production publication follows owner and applicable approvals. |

**Retest checklist**

- TCS, RELIANCE and INFY return a correct-symbol forecast with genuine, traceable data or an explicit abstention with a reason. `ZZZINVALIDTEST` returns unknown symbol and produces zero predictions, explanations and orders.
- MRF fast-switch test forces two responses to finish out of order. Only the current selection can render or enable a trade. Repeat after navigation and after AI generation.
- Fixtures cover incomplete bars, zero/negative prices, NaN/Infinity, null volume, duplicate timestamps, unsupported exchange, holidays, special sessions, split adjustments, stale feed, provider timeout and restart.
- Confirm sources and timestamps across ticker, stock header, chart, screener and orders. Quotes compared at the same timestamp and exchange agree within the documented tolerance. Compare data sampled during an open and closed session.
- AI outage and missing-key tests leave forecasts usable when data and model are healthy. Screener can distinguish zero matches from data failure. Unsupported options or assets show unavailable.
- Buy and sell five TCS shares in staging. Reconcile cash, positions and ledger using the simulated fills and fees. Test duplicate retries, insufficient funds, stale prices and concurrent requests. Verify account isolation.
- Record browser, viewport, environment, commit, test time, request IDs, and evidence for each failure. Distinguish fixture tests, provider-backed staging checks and tests blocked by credentials or rights.

## 6. Copy-paste prompt for your coding tool

~~~text
You are implementing the attached MAX MARKET plan in the existing repository. Work directly on the code. Start by inspecting the stack, route handlers, data providers, symbol resolution, model files, schemas, UI states, CI, and deployment configuration. Map each verified bug to the relevant files and add a failing regression check. Preserve the existing UI and paper-trade behavior where compatible with the plan.

Implement Phase A first. Reproduce and fix invalid JSON in stock and prediction responses, including atr_14: NaN. Validate source bars, require finite model inputs and outputs, and enforce strict JSON. Reject ZZZINVALIDTEST before inference, explanations or order actions. Remove fabricated production prices and stale prediction carry-over after switching to MRF. Bind all displayed results to instrument ID and request identity. Add typed errors, a bounded loading state and safe retry behavior. Diagnose AI Studio and stock AI failures and provide an explanation from structured model facts when the optional AI provider is unavailable. Distinguish empty screener results from provider errors.

Continue with Phases B through D as far as the repository and entitlements allow. Reuse the existing stack and provider adapters where they meet the contract. Start with NSE cash equities and daily data. Require documented data rights, instrument metadata, session-aware freshness, corporate actions, traceable sources and genuine history. Use isolated fixtures for tests. Keep unentitled or unconfigured features unavailable in production. Keep public security-specific signals and real-money actions gated at the server.

Implement the hybrid model for 1, 5 and 20 exchange sessions using the plan's baselines, GBDT classification, quantile regression, tested mean reversion, temporal calibration and abstention. Validate point-in-time features and purged chronological folds. Produce reproducible metrics, interval coverage and a net-cost backtest. Keep promotion gated on agreed out-of-sample acceptance criteria. Use the approved baseline or abstain if a candidate fails, according to the documented release policy.

Run the repository checks plus targeted API and browser tests. Prove valid ticker behavior for TCS, RELIANCE and INFY, invalid ticker rejection, the MRF race condition, missing history, provider outage, data labels, and the virtual buy/sell ledger. Clearly separate fixture-backed verification from live-feed verification. Work in staging. Ask only for essential missing information such as the provider choice, secure staging credentials or publication scope, and continue independent fixes while waiting. Never hardcode credentials or display fixtures as genuine market data. If no provider or model is configured, show an explicit unavailable state.

Deliver changed files, commands, actual test outcomes, staging URL if available, before/after evidence, model metrics if a real evaluation ran, remaining blockers, required environment variable names without values, and rollback steps. Claim production readiness only when the corresponding release checks have passed.
~~~
