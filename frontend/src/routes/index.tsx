import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { ArrowRight, Sparkles, Cpu, Landmark, HeartPulse, ShoppingCart, Wifi, Droplet, Zap, Cog } from "lucide-react";
import { TopBar, TickerTape, WatchlistPanel } from "@/components/market/Chrome";
import { Delta, Gauge, LivePrice, Panel, Sparkline } from "@/components/market/primitives";
import { AI_SIGNALS, NEWS, SECTOR_PERF, candles, useLiveQuotes } from "@/lib/market";

const Globe3D = lazy(() => import("@/components/market/Globe3D"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAX MARKET — Hybrid ML & AI Trading Suite" },
      {
        name: "description",
        content:
          "Institutional trading terminal powered by Pro Hybrid ML Model Trade Prediction and Explainable AI. Live NSE/BSE execution, risk management & 3D market analytics.",
      },
      { property: "og:title", content: "MAX MARKET — Pro Hybrid ML Trade Prediction" },
      { property: "og:description", content: "Live indices, hybrid ML trade signals, sector heatmaps and an institutional 3D market globe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const SECTOR_TAGS = [
  { label: "TECHNOLOGY", pct: 1.12, Icon: Cpu, pos: "top-[8%] left-[14%]" },
  { label: "CONSUMER", pct: 0.72, Icon: ShoppingCart, pos: "top-[6%] right-[10%]" },
  { label: "HEALTHCARE", pct: 0.18, Icon: HeartPulse, pos: "top-[38%] right-[2%]" },
  { label: "FINANCIALS", pct: 0.85, Icon: Landmark, pos: "top-[34%] left-[2%]" },
  { label: "COMMUNICATION", pct: -0.12, Icon: Wifi, pos: "bottom-[30%] right-[4%]" },
  { label: "ENERGY", pct: -0.35, Icon: Droplet, pos: "bottom-[32%] left-[6%]" },
  { label: "UTILITIES", pct: -0.08, Icon: Zap, pos: "bottom-[12%] right-[14%]" },
  { label: "INDUSTRIALS", pct: 0.45, Icon: Cog, pos: "bottom-[8%] left-[22%]" },
];

function Home() {
  const quotes = useLiveQuotes();
  const [niftyData, setNiftyData] = useState<{ price: number; changePct: number } | null>(null);

  useEffect(() => {
    fetch("/api/all-india-indices")
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.indices)) {
          const n = res.indices.find((x: any) => x.symbol === "NIFTY 50");
          if (n) setNiftyData({ price: n.price, changePct: n.change_pct });
        }
      })
      .catch((e) => console.error("Error fetching live Nifty:", e));
  }, []);

  const niftyPrice = niftyData?.price ?? 24834.85;
  const niftyChange = niftyData?.changePct ?? 0.68;
  const nifty = useMemo(() => candles("NIFTY", 60, niftyPrice).map((c) => c.c), [niftyPrice]);
  const [tab, setTab] = useState<"GAINERS" | "LOSERS" | "ACTIVE">("GAINERS");

  const movers = [...quotes].sort((a, b) =>
    tab === "GAINERS" ? b.changePct - a.changePct : tab === "LOSERS" ? a.changePct - b.changePct : b.price - a.price,
  );

  return (
    <div className="min-h-screen bg-background">
      <TopBar />

      <main className="space-y-4 px-4 py-4">
        {/* HERO */}
        <section className="relative grid gap-6 overflow-hidden rounded-lg border border-border bg-[radial-gradient(80%_120%_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)] p-6 lg:grid-cols-[minmax(300px,1fr)_1.15fr_320px]">
          <div className="relative z-10 flex flex-col justify-center">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[0.65rem] font-bold text-primary w-fit uppercase tracking-widest">
              <span className="size-2 rounded-full bg-bull animate-pulse" /> Hybrid ML Trade Prediction Engine Live
            </div>
            <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight md:text-6xl">
              MAX
              <span className="grad-text mt-1 block text-4xl md:text-5xl">MARKET</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Institutional Hybrid ML Trade Predictions, Multi-Horizon Quant Models, and Plain-English AI Reasoning.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/terminal"
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold tracking-[0.14em] text-primary-foreground uppercase shadow-[var(--glow-cyan)] transition hover:brightness-110"
              >
                Explore Markets
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </Link>
              <Link
                to="/galaxy"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-xs font-bold tracking-[0.14em] uppercase transition hover:border-primary/60 hover:text-primary"
              >
                Ask AI <Sparkles className="size-4 text-accent" />
              </Link>
            </div>

            <div className="panel mt-8 max-w-sm p-4">
              <p className="text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">Market Sentiment</p>
              <div className="mt-2 flex items-center gap-5">
                <Gauge value={68} label="Bullish" />
                <div className="flex-1 space-y-2 text-xs">
                  {[
                    ["Bullish", 68, "text-bull"],
                    ["Neutral", 23, "text-muted-foreground"],
                    ["Bearish", 9, "text-bear"],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="flex items-center justify-between gap-3">
                      <span className={c as string}>{l}</span>
                      <span className="num">{v}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[0.65rem] leading-relaxed text-muted-foreground">
                AI derived from market breadth, volatility, momentum & news flow.
              </p>
            </div>
          </div>

          {/* 3D globe */}
          <div className="relative min-h-[380px]">
            <Suspense fallback={null}>
              <Globe3D className="absolute inset-0 h-full w-full" />
            </Suspense>
            {SECTOR_TAGS.map(({ label, pct, Icon, pos }) => (
              <div key={label} className={`float-y absolute ${pos} flex items-center gap-2`}>
                <span className="grid size-7 place-items-center rounded-full border border-primary/40 bg-background/70">
                  <Icon className="size-3.5 text-primary" />
                </span>
                <div className="leading-tight">
                  <p className="text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
                  <Delta value={pct} />
                </div>
              </div>
            ))}
          </div>

          {/* right rail */}
          <div className="space-y-4">
            <Panel
              title="Watchlist"
              action={
                <Link to="/terminal" className="text-[0.65rem] text-primary hover:underline">
                  VIEW ALL →
                </Link>
              }
            >
              <WatchlistPanel />
            </Panel>

            <Panel
              title="AI Signals"
              action={<span className="rounded bg-primary/15 px-2 py-0.5 text-[0.6rem] font-bold text-primary">3 NEW</span>}
            >
              <ul className="space-y-3">
                {AI_SIGNALS.slice(0, 3).map((s) => (
                  <li key={s.symbol}>
                    <Link
                      to="/stock/$symbol"
                      params={{ symbol: s.symbol }}
                      className="grid grid-cols-[1fr_80px] items-center gap-2 p-1.5 -mx-1.5 rounded-md hover:bg-secondary/40 transition group cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold group-hover:text-primary transition">{s.symbol}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[0.6rem] font-bold ${
                              s.action === "BUY"
                                ? "bg-bull/15 text-bull"
                                : s.action === "SELL"
                                  ? "bg-bear/15 text-bear"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {s.action}
                          </span>
                        </div>
                        <p className="text-[0.68rem] text-muted-foreground">{s.note}</p>
                        <p className="num text-[0.65rem] text-muted-foreground">
                          Target {s.target} · Confidence {s.confidence}%
                        </p>
                      </div>
                      <div className="h-10">
                        <Sparkline
                          data={candles(s.symbol, 24, s.target).map((c) => c.c)}
                          color={s.action === "SELL" ? "var(--bear)" : "var(--bull)"}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </section>

        <TickerTape />

        {/* BOTTOM GRID */}
        <section className="grid gap-4 xl:grid-cols-5">
          <Panel title="Market Overview" className="xl:col-span-1">
            <Link to="/stock/$symbol" params={{ symbol: "NIFTY" }} className="block group cursor-pointer">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground font-semibold group-hover:text-primary transition">NIFTY 50 (LIVE) →</span>
                <div className="text-right">
                  <LivePrice value={niftyPrice} className="text-sm text-primary font-bold" />
                  <Delta value={niftyChange} className="ml-2" />
                </div>
              </div>
              <div className="h-32">
                <Sparkline data={nifty} color="var(--primary)" height={120} />
              </div>
              <div className="num mt-2 flex justify-between text-[0.6rem] text-muted-foreground">
                {["09:15", "11:00", "12:45", "14:30", "16:00"].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </Link>
          </Panel>

          <Panel title="Top Movers">
            <div className="mb-3 flex gap-1">
              {(["GAINERS", "LOSERS", "ACTIVE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-2.5 py-1 text-[0.62rem] font-bold tracking-widest transition ${
                    tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <ul className="divide-y divide-border/60">
              {movers.slice(0, 6).map((m) => (
                <li key={m.symbol}>
                  <Link
                    to="/stock/$symbol"
                    params={{ symbol: m.symbol }}
                    className="flex items-center justify-between py-2 text-sm transition hover:text-primary"
                  >
                    <span>{m.symbol}</span>
                    <span className="flex items-center gap-3">
                      <LivePrice value={m.price} className="text-xs" />
                      <Delta value={m.changePct} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Market Heatmap">
            <div className="grid grid-cols-3 gap-1.5">
              {SECTOR_PERF.slice(0, 9).map((s) => {
                const up = s.pct >= 0;
                const i = Math.min(1, Math.abs(s.pct) / 1.2);
                const sectorLeaderMap: Record<string, string> = {
                  "Financial Services": "HDFCBANK",
                  "IT Services": "TCS",
                  "Oil & Gas": "RELIANCE",
                  "Automobile": "M&M",
                  "Consumer Goods": "HINDUNILVR",
                  "Pharma": "SUNPHARMA",
                  "Metals": "TATASTEEL",
                  "Power": "NTPC",
                  "Telecom": "BHARTIARTL",
                };
                const targetSym = sectorLeaderMap[s.name] || "RELIANCE";

                return (
                  <Link
                    key={s.name}
                    to="/stock/$symbol"
                    params={{ symbol: targetSym }}
                    className="rounded p-2 text-center transition hover:scale-[1.04] cursor-pointer block"
                    style={{
                      background: `color-mix(in oklab, ${up ? "var(--bull)" : "var(--bear)"} ${18 + i * 55}%, transparent)`,
                    }}
                    title={`View sector leader ${targetSym} details`}
                  >
                    <p className="truncate text-[0.6rem] font-semibold text-foreground">{s.name}</p>
                    <p className="num text-[0.68rem] font-bold">
                      {up ? "+" : ""}
                      {s.pct.toFixed(2)}%
                    </p>
                    <span className="text-[0.55rem] text-muted-foreground block font-mono">({targetSym})</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel title="News & Insights">
            <ul className="space-y-3">
              {NEWS.slice(0, 4).map((n) => (
                <li key={n.title} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-xs leading-snug">{n.title}</p>
                  <p className="mt-1 text-[0.6rem] text-muted-foreground">
                    {n.ago} · {n.src}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Portfolio Overview">
            <p className="text-[0.62rem] tracking-widest text-muted-foreground uppercase">Total Value</p>
            <p className="num mt-1 text-2xl font-bold">₹ 28,75,450.75</p>
            <Delta value={1.35} className="mt-1" />
            <div className="mt-3 h-24">
              <Sparkline data={candles("PORT", 40, 2875450).map((c) => c.c)} color="var(--bull)" height={90} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
              <div>
                <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">Day P/L</p>
                <p className="num text-bull">₹ 38,205.45</p>
              </div>
              <div>
                <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">Holdings</p>
                <p className="num">24</p>
              </div>
            </div>
          </Panel>
        </section>
      </main>
    </div>
  );
}
