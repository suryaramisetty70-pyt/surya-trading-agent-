import { fetchProviderJson } from "@/lib/provider-request";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { TopBar } from "@/components/market/Chrome";
import { Delta, LivePrice, Panel } from "@/components/market/primitives";
import CandleChart from "@/components/market/CandleChart";
import MLPredictionCard, { PredictionData } from "@/components/market/MLPredictionCard";
import { findQuote, fmt, useLiveQuotes } from "@/lib/market";
import { usePaperTrading } from "@/lib/paperTrading";
import { useAIKeyManager } from "@/lib/userAccount";
import { Cpu, ArrowUpRight, ArrowDownRight } from "lucide-react";

export const Route = createFileRoute("/stock/$symbol")({
  loader: ({ params }) => {
    const q = findQuote(params.symbol);
    if (!q) throw notFound();
    return { quote: q };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Symbol unavailable — MAX MARKET" }, { name: "robots", content: "noindex" }] };
    const q = loaderData.quote;
    const title = `${q.symbol} — ${q.name} Live Chart, Technicals & Valuation`;
    const description = `${q.name} (${q.exchange}) live price, candlestick chart with EMA, technical score, AI market intelligence, fundamentals and DCF valuation.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => {
    const { quote } = Route.useLoaderData();
    return <StockPage key={quote.symbol} />;
  },
});

const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"] as const;
const SIDE = ["Overview", "Fundamentals", "Valuation", "News"];
const PERF_COLS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"];

function StockPage() {
  const { quote } = Route.useLoaderData();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [tab, setTab] = useState("Overview");
  const [activeControl, setActiveControl] = useState<string | null>(null);

  // Live real data state from Python backend
  const [liveData, setLiveData] = useState<any>(null);
  const [loadingLive, setLoadingLive] = useState(true);

  // ML Prediction state
  const [mlPrediction, setMlPrediction] = useState<PredictionData | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(true);
  const [forecastError, setForecastError] = useState("");

  // Paper trading integration
  const paper = usePaperTrading();
  const peerQuotes = useLiveQuotes();
  const { activeKey } = useAIKeyManager();
  const [tradeQty, setTradeQty] = useState(10);
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const activeSymbol = quote.symbol.toUpperCase();

    // Immediately clear previous symbol's data and explanation to prevent stale view
    setLiveData(null);
    setMlPrediction(null);
    setLoadingLive(true);
    setLoadingPrediction(true);
    setForecastError("");

    fetch(`/api/stock-data?ticker=${encodeURIComponent(activeSymbol)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!controller.signal.aborted && json.status === "success" && json.data) {
          if (Number.isFinite(json.data.current_price) && json.data.current_price > 0) {
            setLiveData(json.data);
          }
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching live stock data:", err);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingLive(false); });

    fetch(`/api/predict?ticker=${encodeURIComponent(activeSymbol)}`, {
      signal: controller.signal,
      headers: activeKey ? { "X-AI-Key": activeKey } : {},
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.status !== "success" || !json.data?.symbol) {
          throw new Error(json.message || "Hybrid forecast unavailable.");
        }
        if (!controller.signal.aborted) setMlPrediction(json.data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setForecastError(err.message || "Hybrid forecast unavailable.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingPrediction(false); });

    return () => {
      controller.abort();
    };
  }, [quote.symbol, activeKey]);

  const hasQuote = !!liveData;
  const canPaperTrade = hasQuote && quote.sector !== "Index";
  const price = liveData?.current_price ?? 0;
  const change = liveData?.change ?? 0;
  const changePct = liveData?.change_pct ?? 0;
  const companyName = liveData?.company_name ?? quote.name;
  const dayHigh = liveData?.day_high ?? 0;
  const dayLow = liveData?.day_low ?? 0;
  const weekHigh = liveData?.week_52_high ?? 0;
  const weekLow = liveData?.week_52_low ?? 0;
  const volumeStr = liveData?.volume ? Number(liveData.volume).toLocaleString("en-IN") : "—";
  const marketCapStr = liveData?.market_cap_cr ? `₹${fmt(liveData.market_cap_cr, 0)} Cr` : "—";

  const metric = (value: number | null | undefined, digits = 2, suffix = "", prefix = "") =>
    typeof value === "number" && Number.isFinite(value) && value !== 0
      ? `${prefix}${fmt(value, digits)}${suffix}` : "—";
  const pe = metric(liveData?.pe_ratio);
  const pb = metric(liveData?.pb_ratio);
  const roe = metric(liveData?.roe, 2, "%");
  const roce = metric(liveData?.roce, 2, "%");
  const revCr = metric(liveData?.revenue_cr, 0, " Cr", "₹");
  const profitMargin = metric(liveData?.profit_margin, 2, "%");
  const eps = metric(liveData?.eps);
  const divYield = metric(liveData?.dividend_yield, 2, "%");
  const debtEquity = metric(liveData?.debt_equity);
  const rsi = metric(liveData?.rsi_14, 1);
  const ema20 = metric(liveData?.ema_20);
  const ema50 = metric(liveData?.ema_50);
  const ema200 = metric(liveData?.ema_200);

  const targetPrice = liveData?.target_price ?? 0;
  const targetHigh = liveData?.target_high ?? 0;
  const targetLow = liveData?.target_low ?? 0;

  const handleBuy = () => {
    if (!canPaperTrade) return;
    const res = paper.buyStock(quote.symbol, companyName, price, tradeQty);
    setTradeMsg({ text: res.message, ok: res.success });
    setTimeout(() => setTradeMsg(null), 4000);
  };

  const handleSell = () => {
    if (!canPaperTrade) return;
    const res = paper.sellStock(quote.symbol, price, tradeQty);
    setTradeMsg({ text: res.message, ok: res.success });
    setTimeout(() => setTradeMsg(null), 4000);
  };

  const userPosition = paper.positions.find((p) => p.symbol.toUpperCase() === quote.symbol.toUpperCase());

  const perf = (seedmul: number) =>
    PERF_COLS.map((_, i) => +(((i + 1) * 1.4 + changePct) * seedmul).toFixed(2));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />

      {/* Instrument header */}
      <div className="panel m-4 flex flex-wrap items-center gap-6 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
            {quote.symbol[0]}
          </span>
          <div>
            <h1 className="font-display text-lg font-bold tracking-wide uppercase">{companyName}</h1>
            <p className="text-[0.65rem] tracking-widest text-primary uppercase">
              {quote.symbol} · {liveData?.exchange || quote.exchange} · India
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          {hasQuote ? <LivePrice value={price} className="text-3xl font-bold" /> : <span>—</span>}
          <span className="text-xs text-muted-foreground">{liveData?.currency_symbol ?? ""}</span>
          {hasQuote && <span
            className={`rounded px-2 py-1 text-xs font-semibold ${changePct >= 0 ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"}`}
          >
            {change >= 0 ? "+" : ""}
            {fmt(change)} ({changePct >= 0 ? "+" : ""}
            {fmt(changePct, 2)}%)
          </span>}
        </div>

        {[
          ["Day Range", dayLow && dayHigh ? `${fmt(dayLow)} – ${fmt(dayHigh)}` : "—"],
          ["52W Range", weekLow && weekHigh ? `${fmt(weekLow)} – ${fmt(weekHigh)}` : "—"],
          ["Volume", volumeStr],
          ["Market Cap", marketCapStr],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">{k}</p>
            <p className="num text-xs font-semibold">{hasQuote ? v : "—"}</p>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground" role="status">
            {loadingLive ? "Syncing market data…" : hasQuote
              ? `${liveData.source ?? "Provider snapshot"} · ${liveData.observed_at ?? "Exchange timestamp unavailable"}`
              : "Market quote unavailable"}
          </span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex gap-4 px-4 pb-6">
        <aside className="sticky top-[70px] hidden h-fit w-[164px] shrink-0 flex-col gap-0.5 lg:flex">
          {SIDE.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-widest uppercase transition ${
                tab === s ? "bg-primary/12 text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}

          {/* Quick Virtual Paper Trading Balance Widget */}
          <div className="panel mt-3 p-3 space-y-1">
            <p className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">Virtual Wallet</p>
            <p className="text-sm font-bold text-primary">₹{paper.cash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            {userPosition && (
              <p className="text-[0.62rem] text-bull font-medium">Holding: {userPosition.quantity} shares</p>
            )}
          </div>

          <div className="panel mt-3 p-3">
            <p className="mb-2 text-[0.58rem] tracking-widest text-muted-foreground uppercase">Peers</p>
            {peerQuotes.filter((p) => p.symbol !== quote.symbol)
              .slice(0, 4)
              .map((p) => (
                <Link
                  key={p.symbol}
                  to="/stock/$symbol"
                  params={{ symbol: p.symbol }}
                  className="flex items-center justify-between py-1 text-[0.7rem] hover:text-primary"
                >
                  {p.symbol}
                  <Delta value={p.changePct} />
                </Link>
              ))}
          </div>
        </aside>

        <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            {/* Chart Panel */}
            <section className="panel">
              <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded px-2.5 py-1 text-[0.68rem] font-semibold transition ${
                      range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <span className="mx-2 h-4 w-px bg-border" />
                {["INDICATORS", "TEMPLATES", "COMPARE"].map((x) => (
                  <button
                    key={x}
                    onClick={() => setActiveControl(activeControl === x ? null : x)}
                    className={`rounded px-2.5 py-1 text-[0.62rem] tracking-widest uppercase transition ${
                      activeControl === x ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>

              {activeControl === "INDICATORS" && (
                <div className="p-3 bg-secondary/30 border-b border-border text-xs flex flex-wrap gap-3">
                  <span className="font-bold text-primary">Active Technical Overlays:</span>
                  <span className="bg-bull/15 text-bull px-2 py-0.5 rounded font-semibold">✓ EMA 20 (₹{ema20})</span>
                  <span className="bg-primary/15 text-primary px-2 py-0.5 rounded font-semibold">✓ EMA 50 (₹{ema50})</span>
                  <span className="bg-violet/15 text-violet px-2 py-0.5 rounded font-semibold">✓ EMA 200 (₹{ema200})</span>
                  <span className="bg-secondary text-foreground px-2 py-0.5 rounded font-semibold">✓ RSI 14 ({rsi})</span>
                </div>
              )}

              {activeControl === "TEMPLATES" && (
                <div className="p-3 bg-secondary/30 border-b border-border text-xs flex gap-3">
                  <span className="font-bold text-primary">Chart Style:</span>
                  <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">Candlestick (Exchange OHLC)</span>
                  <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">Heikin-Ashi</span>
                  <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">Area Line</span>
                </div>
              )}

              {activeControl === "COMPARE" && (
                <div className="p-3 bg-secondary/30 border-b border-border text-xs flex items-center gap-3">
                  <span className="font-bold text-primary">Compare {quote.symbol} vs:</span>
                  <span className="bg-bull/15 text-bull px-2 py-0.5 rounded font-bold">NIFTY 50 (+0.68%)</span>
                  <span className="bg-secondary text-foreground px-2 py-0.5 rounded font-semibold">TCS (+1.12%)</span>
                  <span className="bg-secondary text-foreground px-2 py-0.5 rounded font-semibold">INFY (+0.85%)</span>
                </div>
              )}

              <div className="px-3 pt-3 text-[0.68rem]">
                <p className="font-semibold">
                  {companyName} · {range} · Provider history
                  <span className="ml-2 inline-block size-2 animate-pulse rounded-full bg-bull align-middle" />
                </p>
                <div className="num mt-1 flex flex-wrap gap-4 text-muted-foreground">
                  <span>O {metric(liveData?.open_price)}</span>
                  <span>H {metric(dayHigh)}</span>
                  <span>L {metric(dayLow)}</span>
                  <span className="text-bull font-bold">C {metric(price)}</span>
                  <span>Vol {volumeStr}</span>
                  <span className="text-chart-1">EMA 20 {ema20}</span>
                  <span className="text-primary">EMA 50 {ema50}</span>
                  <span className="text-violetq">EMA 200 {ema200}</span>
                </div>
              </div>

              {/* Real Candlestick Chart passing live candle series and ML 5-Day Projection Cone */}
              {liveData?.chart_series?.candles?.length ? <CandleChart
                symbol={quote.symbol}
                base={price}
                range={range}
                candlesData={liveData?.chart_series?.candles}
                projectionData={mlPrediction?.projection_cone ?? []}
              /> : <p className="p-6 text-sm text-muted-foreground">{loadingLive ? "Loading chart…" : "Chart unavailable"}</p>}
            </section>

            {/* Surya ML Predictive Intelligence Engine Card */}
            {forecastError && <p role="alert" className="p-4 text-bear">{forecastError}</p>}
            <MLPredictionCard
              prediction={mlPrediction}
              loading={loadingPrediction}
              currentQuotePrice={canPaperTrade ? price : 0}
              asOf={liveData?.observed_at}
            />

            {/* 1-Click Virtual Paper Trading Console (Inspired by OpenAlgo) */}
            <Panel title={`1-Click Virtual Paper Trading Console — ${quote.symbol}`}>
              <div className="space-y-3 p-1">
                {quote.sector === "Index" && <p className="text-xs text-muted-foreground">Choose an equity to paper trade shares.</p>}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Quantity:</span>
                    <div className="flex items-center gap-1">
                      {[5, 10, 25, 50, 100].map((q) => (
                        <button
                          key={q}
                          onClick={() => setTradeQty(q)}
                          className={`rounded px-2.5 py-1 text-xs font-semibold ${
                            tradeQty === q ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-right">
                    <span className="text-muted-foreground">Order Value: </span>
                    <span className="font-bold text-foreground">{hasQuote ? `₹${fmt(price * tradeQty, 2)}` : "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={handleBuy}
                    disabled={!canPaperTrade}
                    className="flex items-center justify-center gap-2 rounded bg-bull py-2.5 text-xs font-bold uppercase text-white hover:brightness-110 active:scale-[0.99] transition"
                  >
                    <ArrowUpRight className="size-4" />
                    Buy {tradeQty} Shares{hasQuote && ` @ ₹${fmt(price)}`}
                  </button>

                  <button
                    onClick={handleSell}
                    disabled={!canPaperTrade || !userPosition || userPosition.quantity < tradeQty}
                    className="flex items-center justify-center gap-2 rounded bg-bear py-2.5 text-xs font-bold uppercase text-white hover:brightness-110 active:scale-[0.99] disabled:opacity-40 transition"
                  >
                    <ArrowDownRight className="size-4" />
                    Sell {tradeQty} Shares
                  </button>
                </div>

                {tradeMsg && (
                  <div
                    className={`rounded p-2.5 text-xs font-semibold text-center ${
                      tradeMsg.ok ? "bg-bull/15 text-bull border border-bull/30" : "bg-bear/15 text-bear border border-bear/30"
                    }`}
                  >
                    {tradeMsg.text}
                  </div>
                )}
              </div>
            </Panel>

            {tab === "Overview" && (
              <Panel title="Illustrative Performance Benchmark">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
                        <th className="py-2 text-left font-medium">Series</th>
                        {PERF_COLS.map((c) => (
                          <th key={c} className="py-2 text-center font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {[
                        { name: quote.symbol, mul: 1 },
                        { name: "NIFTY 50", mul: 0.55 },
                        { name: "RELATIVE", mul: 0.42 },
                      ].map((row) => (
                        <tr key={row.name}>
                          <td className="py-2 font-semibold">{row.name}</td>
                          {perf(row.mul).map((v, i) => (
                            <td key={i} className={`num py-2 text-center ${v >= 0 ? "text-bull" : "text-bear"}`}>
                              {v >= 0 ? "+" : ""}
                              {v}%
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}

            {tab === "Fundamentals" && (
              <Panel title={`Live Financial Statement — ${quote.symbol}`}>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-secondary/30 rounded border border-border">
                      <p className="text-muted-foreground uppercase text-[0.6rem]">Annual / TTM Revenue</p>
                      <p className="num text-base font-bold">{revCr}</p>
                      <p className="text-bull text-[0.65rem]">Official Financial Filing</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded border border-border">
                      <p className="text-muted-foreground uppercase text-[0.6rem]">Profit Margin</p>
                      <p className="num text-base font-bold">{profitMargin}</p>
                      <p className="text-bull text-[0.65rem]">Operating Efficiency</p>
                    </div>
                    <div className="p-3 bg-secondary/30 rounded border border-border">
                      <p className="text-muted-foreground uppercase text-[0.6rem]">Return on Equity (ROE)</p>
                      <p className="num text-base font-bold">{roe}</p>
                      <p className="text-bull text-[0.65rem]">ROCE: {roce}</p>
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {tab === "Valuation" && (
              <Panel title={`Valuation & Price Targets — ${quote.symbol}`}>
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground">Institutional Target Price Models vs Market Median</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-bear/10 rounded border border-bear/30">
                      <p className="text-bear font-bold">BEAR CASE / SUPPORT</p>
                      <p className="num text-lg font-bold">{metric(targetLow, 0, "", "₹")}</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded border border-primary/30">
                      <p className="text-primary font-bold">CONSENSUS TARGET</p>
                      <p className="num text-lg font-bold">{metric(targetPrice, 0, "", "₹")}</p>
                    </div>
                    <div className="p-3 bg-bull/10 rounded border border-bull/30">
                      <p className="text-bull font-bold">BULL CASE TARGET</p>
                      <p className="num text-lg font-bold">{metric(targetHigh, 0, "", "₹")}</p>
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            {tab === "News" && (
              <Panel title={`Provider News — ${quote.symbol}`}>
                {liveData?.news_headlines?.length ? (
                  <ul className="space-y-2 text-xs">
                    {liveData.news_headlines.map((item: { title: string; date?: string; source?: string }, index: number) => (
                      <li key={index}>{item.title} · {[item.source, item.date].filter(Boolean).join(" · ")}</li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No provider headlines available.</p>}
              </Panel>
            )}
          </div>

          {/* Right Sidebar: Multi-Agent Consensus, Live Fundamentals, and AI Studio */}
          <div className="space-y-4">
            <Panel title="Market Indicators">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p>RSI (14) <strong>{rsi}</strong></p>
                <p>EMA (50) <strong>{ema50}</strong></p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">The paper trade shortcut follows the hybrid forecast below the chart.</p>
            </Panel>

            {/* Live Fundamentals Grid */}
            <Panel title="Provider Fundamentals">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  ["Market Cap", marketCapStr],
                  ["P/E (TTM)", pe],
                  ["P/B", pb],
                  ["ROE", roe],
                  ["ROCE", roce],
                  ["Revenue", revCr],
                  ["Profit Margin", profitMargin],
                  ["EPS", `₹${eps}`],
                  ["Div Yield", divYield],
                  ["Debt/Equity", debtEquity],
                ].map(([k, v]) => (
                  <div key={k} className="rounded bg-secondary/40 p-2">
                    <p className="text-[0.52rem] tracking-widest text-muted-foreground uppercase">{k}</p>
                    <p className="num text-[0.72rem] font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            </Panel>

            {/* DCF Valuation */}
            <Panel title="Provider Analyst Targets">
              <div className="grid grid-cols-3 text-center text-xs">
                {[
                  ["Bear Case", targetLow, "text-bear"],
                  ["Consensus", targetPrice, "text-primary"],
                  ["Bull Case", targetHigh, "text-bull"],
                ].map(([k, v, c]) => (
                  <div key={k as string}>
                    <p className={`text-[0.58rem] font-bold tracking-widest uppercase ${c}`}>{k}</p>
                    <p className="num text-lg font-bold">{metric(v as number, 0, "", "₹")}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-bear via-primary to-bull" />
              <div className="num mt-1 flex justify-between text-[0.6rem] text-muted-foreground">
                <span>{metric(targetLow, 0)}</span>
                <span className="text-foreground font-bold">Current {metric(price)}</span>
                <span>{metric(targetHigh, 0)}</span>
              </div>
            </Panel>

            {/* Groq AI Institutional Studio */}
            <Panel title="Groq Institutional AI Engine">
              <AiStudioPanel symbol={quote.symbol} name={companyName} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiStudioPanel({ symbol, name }: { symbol: string; name: string }) {
  const [lang, setLang] = useState("English");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportSource, setReportSource] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reportRequest = useRef<AbortController | null>(null);

  // Clear report on symbol change to avoid stale carry-over
  useEffect(() => {
    setReport(null);
    setErrorMsg(null);
    setReportSource(null);
    setLoading(false);
    return () => reportRequest.current?.abort();
  }, [symbol]);

  const runAnalysis = async () => {
    setLoading(true);
    setReport(null);
    setErrorMsg(null);
    setReportSource(null);

    reportRequest.current?.abort();
    const controller = new AbortController();
    reportRequest.current = controller;
    const customKey = localStorage.getItem("user_groq_api_key") || "";

    try {
      const { json: data } = await fetchProviderJson("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ticker: symbol, language: lang, api_key: customKey }),
      });
      if (controller.signal.aborted) return;
      if (data.status === "success") {
        setReport(data.master_report);
        setReportSource(data.source || "ai");
        setErrorMsg(null);
      } else {
        setErrorMsg(data.message || "Error generating report.");
      }
    } catch (e: any) {
      if (controller.signal.aborted) return;
      if (e.name === "AbortError") {
        setErrorMsg("AI Report request timed out. Provider latency exceeded deadline.");
      } else {
        setErrorMsg("Error connecting to AI Server. Please check network or API key.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const downloadReportFile = () => {
    if (!report) return;
    const element = document.createElement("a");
    const file = new Blob([report], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${symbol}_AI_Master_Report.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const speakReport = () => {
    if (!report) return;
    window.speechSynthesis.cancel();
    const cleanText = report.replace(/[#*`_]/g, "").substring(0, 1000);
    const u = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none"
        >
          <option value="English">🌐 English AI</option>
          <option value="Hindi">🇮🇳 Hindi (हिंदी)</option>
          <option value="Telugu">🇮🇳 Telugu (తెలుగు)</option>
          <option value="Tamil">🇮🇳 Tamil (தமிழ்)</option>
        </select>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className="rounded bg-primary px-4 py-1.5 text-xs font-bold tracking-wider text-primary-foreground uppercase hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Generating Report..." : "⚡ Generate AI Report"}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-bear/40 bg-bear/10 flex items-center justify-between text-xs text-bear">
          <span>{errorMsg}</span>
          <button
            onClick={runAnalysis}
            className="px-2.5 py-1 rounded bg-bear text-white font-bold text-[0.65rem] hover:brightness-110"
          >
            Retry
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[0.65rem]">
            <span className="font-mono text-muted-foreground">{symbol} Analysis</span>
            {reportSource === "structured_fallback" ? (
              <span className="px-2 py-0.5 rounded font-bold bg-chart-4/15 text-chart-4 border border-chart-4/30">
                MAX MARKET Institutional Deterministic Engine (Structured Fallback)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-bold bg-primary/15 text-primary border border-primary/30">
                Groq LLM Engine Verified
              </span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto rounded border border-border/80 bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono text-[0.7rem]">
            {report}
          </div>
          <div className="flex gap-2">
            <button
              onClick={speakReport}
              className="flex-1 rounded border border-primary/50 bg-primary/10 py-2 text-[0.68rem] font-bold tracking-wider text-primary uppercase hover:bg-primary/20"
            >
              🔊 Audio Listen
            </button>
            <button
              onClick={downloadReportFile}
              className="flex-1 rounded border border-bull/50 bg-bull/10 py-2 text-[0.68rem] font-bold tracking-wider text-bull uppercase hover:bg-bull/20"
            >
              📄 Download Report (.MD)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
