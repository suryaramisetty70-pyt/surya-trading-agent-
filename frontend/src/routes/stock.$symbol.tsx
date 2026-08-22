import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { TopBar } from "@/components/market/Chrome";
import { Delta, Gauge, LivePrice, Panel } from "@/components/market/primitives";
import CandleChart from "@/components/market/CandleChart";
import { BASE_QUOTES, findQuote, fmt } from "@/lib/market";

export const Route = createFileRoute("/stock/$symbol")({
  loader: ({ params }) => {
    const q = findQuote(params.symbol);
    if (!q) throw notFound();
    return { quote: q };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Symbol unavailable — Surya" }, { name: "robots", content: "noindex" }] };
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
  component: StockPage,
});

const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"] as const;
const SIDE = ["Overview", "Charts", "Fundamentals", "Valuation", "News", "Screener", "Watchlist", "Portfolio", "Alerts", "Notes", "Settings"];
const PERF_COLS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"];

function StockPage() {
  const { quote } = Route.useLoaderData();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [tab, setTab] = useState("Overview");

  const perf = (seedmul: number) =>
    PERF_COLS.map((_, i) => +(((i + 1) * 1.4 + quote.changePct) * seedmul).toFixed(2));

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      {/* Instrument header */}
      <div className="panel m-4 flex flex-wrap items-center gap-6 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
            {quote.symbol[0]}
          </span>
          <div>
            <h1 className="font-display text-lg font-bold tracking-wide uppercase">{quote.name}</h1>
            <p className="text-[0.65rem] tracking-widest text-primary uppercase">
              {quote.symbol} · {quote.exchange} · India
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <LivePrice value={quote.price} className="text-3xl font-bold" />
          <span className="text-xs text-muted-foreground">INR</span>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${quote.changePct >= 0 ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"}`}
          >
            {quote.change >= 0 ? "+" : ""}
            {fmt(quote.change)} ({quote.changePct >= 0 ? "+" : ""}
            {quote.changePct}%)
          </span>
        </div>
        {[
          ["Day Range", `${fmt(quote.price * 0.986)} – ${fmt(quote.price * 1.008)}`],
          ["52W Range", `${fmt(quote.price * 0.72)} – ${fmt(quote.price * 1.06)}`],
          ["Volume", quote.volume],
          ["Market Cap", `${quote.marketCap} INR`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">{k}</p>
            <p className="num text-xs">{v}</p>
          </div>
        ))}
        <span className="ml-auto flex items-center gap-2 rounded-md border border-bull/40 bg-bull/10 px-3 py-1.5 text-[0.65rem] font-bold tracking-widest text-bull">
          <span className="size-2 animate-pulse rounded-full bg-bull" /> LIVE
        </span>
      </div>

      <div className="flex gap-4 px-4 pb-6">
        <aside className="sticky top-[70px] hidden h-fit w-[164px] shrink-0 flex-col gap-0.5 lg:flex">
          {SIDE.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded px-3 py-2.5 text-left text-[0.68rem] font-semibold tracking-widest uppercase transition ${
                tab === s ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <div className="panel mt-3 p-3">
            <p className="mb-2 text-[0.58rem] tracking-widest text-muted-foreground uppercase">Peers</p>
            {BASE_QUOTES.filter((p) => p.sector === quote.sector && p.symbol !== quote.symbol)
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
                  <button key={x} className="rounded px-2.5 py-1 text-[0.62rem] tracking-widest text-muted-foreground uppercase hover:text-primary">
                    {x}
                  </button>
                ))}
              </div>
              <div className="px-3 pt-3 text-[0.68rem]">
                <p className="font-semibold">
                  {quote.name} · {range} · {quote.exchange}
                  <span className="ml-2 inline-block size-2 animate-pulse rounded-full bg-bull align-middle" />
                </p>
                <div className="num mt-1 flex flex-wrap gap-4 text-muted-foreground">
                  <span>O {fmt(quote.price * 0.991)}</span>
                  <span>H {fmt(quote.price * 1.008)}</span>
                  <span>L {fmt(quote.price * 0.986)}</span>
                  <span className="text-bull">C {fmt(quote.price)}</span>
                  <span>Vol {quote.volume}</span>
                  <span className="text-chart-1">EMA 20 {fmt(quote.price * 0.965)}</span>
                  <span className="text-primary">EMA 50 {fmt(quote.price * 0.93)}</span>
                  <span className="text-violetq">EMA 200 {fmt(quote.price * 0.86)}</span>
                </div>
              </div>
              <CandleChart symbol={quote.symbol} base={quote.price} range={range} />
            </section>

            <Panel title="Financial Performance">
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
          </div>

          <div className="space-y-4">
            <Panel title="Technical Score">
              <div className="flex items-center gap-5">
                <Gauge value={74} label="Bullish" />
                <div className="flex-1 space-y-2 text-xs">
                  {[
                    ["Trend", "BULLISH", "text-bull"],
                    ["Momentum", "STRONG", "text-bull"],
                    ["Volatility", "MODERATE", "text-chart-4"],
                    ["Volume", "STRONG", "text-bull"],
                  ].map(([k, v, c]) => (
                    <div key={k} className="flex justify-between border-b border-border/50 pb-1.5">
                      <span className="tracking-widest text-muted-foreground uppercase">{k}</span>
                      <span className={`font-semibold ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="AI Market Intelligence">
              <div className="grid grid-cols-2 gap-4 text-[0.7rem]">
                <div>
                  <p className="mb-2 font-bold tracking-widest text-bull uppercase">Bullish factors</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    {["Strong revenue & profit growth", "Leader in core business segments", "Improving retail momentum", "Healthy balance sheet", "Rising dividends & FCF"].map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-bull" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 font-bold tracking-widest text-bear uppercase">Bearish factors</p>
                  <ul className="space-y-1.5 text-muted-foreground">
                    {["Regulatory risks in core segment", "High exposure to input costs", "Competitive pricing pressure", "Margins under pressure", "Global macro & rate uncertainty"].map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-bear" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>

            <Panel title="Fundamentals">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  ["Market Cap", quote.marketCap],
                  ["P/E (TTM)", "24.31"],
                  ["P/B", "2.23"],
                  ["ROE", "9.86%"],
                  ["ROCE", "8.47%"],
                  ["Revenue", "9.02T"],
                  ["Net Profit", "80,306Cr"],
                  ["EPS", "117.45"],
                  ["Div Yield", "0.74%"],
                  ["Debt/Equity", "0.48"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded bg-secondary/40 p-2">
                    <p className="text-[0.52rem] tracking-widest text-muted-foreground uppercase">{k}</p>
                    <p className="num text-[0.72rem] font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="DCF Valuation" action={<span className="text-[0.6rem] text-muted-foreground">Fair Value (INR)</span>}>
              <div className="grid grid-cols-3 text-center text-xs">
                {[
                  ["Bear Case", quote.price * 0.75, "text-bear"],
                  ["Base Case", quote.price * 1.02, "text-primary"],
                  ["Bull Case", quote.price * 1.31, "text-bull"],
                ].map(([k, v, c]) => (
                  <div key={k as string}>
                    <p className={`text-[0.58rem] font-bold tracking-widest uppercase ${c}`}>{k}</p>
                    <p className="num text-lg font-bold">{fmt(v as number, 0)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gradient-to-r from-bear via-primary to-bull" />
              <div className="num mt-1 flex justify-between text-[0.6rem] text-muted-foreground">
                <span>{fmt(quote.price * 0.7, 0)}</span>
                <span className="text-foreground">Current {fmt(quote.price, 2)}</span>
                <span>{fmt(quote.price * 1.4, 0)}</span>
              </div>
            </Panel>

            <Panel title="News Sentiment">
              <div className="flex items-center gap-5">
                <Gauge value={68} label="Positive" size={110} />
                <div className="flex-1 space-y-1.5 text-xs">
                  {[
                    ["Positive", 68, "bg-bull"],
                    ["Negative", 18, "bg-bear"],
                    ["Neutral", 14, "bg-muted-foreground"],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${c}`} />
                      <span className="flex-1">{l}</span>
                      <span className="num">{v}%</span>
                    </div>
                  ))}
                  <p className="pt-2 text-[0.6rem] text-muted-foreground">Based on 42 news articles</p>
                </div>
              </div>
            </Panel>

            <Panel title="AI Educational Studio (Groq Llama 3.3 70B)">
              <AiStudioPanel symbol={quote.symbol} name={quote.name} />
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

  const runAnalysis = async () => {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, language: lang }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setReport(data.master_report);
      } else {
        setReport("Error generating report. Please check API connection.");
      }
    } catch (e) {
      setReport("Error connecting to AI Server.");
    } finally {
      setLoading(false);
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
          className="rounded bg-primary px-4 py-1.5 text-xs font-bold tracking-wider text-primary-foreground uppercase hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Generating Report..." : "⚡ Generate AI Report"}
        </button>
      </div>

      {report && (
        <div className="space-y-3">
          <div className="max-h-80 overflow-y-auto rounded border border-border/80 bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
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
              📄 Download Report (.MD / PDF)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
