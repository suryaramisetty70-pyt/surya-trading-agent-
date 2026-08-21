import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Globe,
  Star,
  PieChart,
  FileText,
  Wallet,
  ShieldCheck,
  BarChart3,
  Newspaper,
  CalendarDays,
  Settings,
} from "lucide-react";
import { TopBar, TickerTape } from "@/components/market/Chrome";
import { Delta, LivePrice, Panel, Sparkline } from "@/components/market/primitives";
import { INDICES, NEWS, SECTOR_PERF, candles, useLiveQuotes } from "@/lib/market";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Nexus Terminal — Institutional Market Dashboard" },
      {
        name: "description",
        content:
          "Institutional-grade terminal: global indices, market movers, sector heatmap, breadth gauges, FII/DII activity and an AI daily brief.",
      },
      { property: "og:title", content: "Nexus Terminal — Institutional Market Dashboard" },
      { property: "og:description", content: "Global indices, movers, sector heatmap, breadth, FII/DII flows and AI daily brief." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});

const SIDE = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Markets", Icon: Globe },
  { label: "Watchlist", Icon: Star },
  { label: "Portfolios", Icon: PieChart },
  { label: "Orders", Icon: FileText },
  { label: "Positions", Icon: Wallet },
  { label: "Risk", Icon: ShieldCheck },
  { label: "Analytics", Icon: BarChart3 },
  { label: "News", Icon: Newspaper },
  { label: "Events", Icon: CalendarDays },
  { label: "Settings", Icon: Settings },
];

const BREADTH = [
  { label: "NIFTY 50", adv: 35, dec: 15 },
  { label: "NIFTY 500", adv: 312, dec: 188 },
  { label: "NIFTY ALL CAP", adv: 689, dec: 411 },
  { label: "NSE TOTAL", adv: 1457, dec: 924 },
];

const FLOWS = [
  { label: "FII CASH (NET)", a: -1863, b: 1245, c: 2341 },
  { label: "DII CASH (NET)", a: 2105, b: 673, c: 6782 },
  { label: "FII FUTURES (NET)", a: -4210, b: -1125, c: -6145 },
  { label: "INDEX FUT (NET)", a: -3125, b: -845, c: -4121 },
];

function Terminal() {
  const quotes = useLiveQuotes();
  const [active, setActive] = useState("Dashboard");
  const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...quotes].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="flex">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[92px] shrink-0 flex-col gap-1 border-r border-border py-3 lg:flex">
          {SIDE.map(({ label, Icon }) => (
            <button
              key={label}
              onClick={() => setActive(label)}
              className={`flex flex-col items-center gap-1.5 px-2 py-3 text-[0.58rem] font-semibold tracking-[0.1em] uppercase transition ${
                active === label
                  ? "border-l-2 border-primary bg-primary/10 text-primary"
                  : "border-l-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-[18px]" />
              {label}
            </button>
          ))}
        </aside>

        <main className="min-w-0 flex-1 space-y-4 p-4">
          <TickerTape />

          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {INDICES.slice(0, 4).map((i) => {
                  const series = candles(i.symbol, 40, i.price).map((c) => c.c);
                  return (
                    <div key={i.symbol} className="panel hover-lift p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold tracking-widest uppercase">{i.symbol}</span>
                        <Delta value={i.changePct} />
                      </div>
                      <LivePrice value={i.price} className="mt-1 block text-xl font-bold" />
                      <div className="mt-2 h-14">
                        <Sparkline data={series} color={i.changePct >= 0 ? "var(--bull)" : "var(--bear)"} height={56} />
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1 border-t border-border pt-2 text-[0.58rem] text-muted-foreground">
                        {["HIGH", "LOW", "ADV", "DEC"].map((k, idx) => (
                          <div key={k}>
                            <p className="tracking-widest">{k}</p>
                            <p className={`num ${idx === 2 ? "text-bull" : idx === 3 ? "text-bear" : "text-foreground"}`}>
                              {idx === 2 ? 35 : idx === 3 ? 15 : (i.price * (idx === 0 ? 1.004 : 0.996)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-4 2xl:grid-cols-2">
                <Panel title="Market Movers">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {[
                      { head: "TOP GAINERS", rows: gainers, tone: "text-bull" },
                      { head: "TOP LOSERS", rows: losers, tone: "text-bear" },
                    ].map((col) => (
                      <div key={col.head}>
                        <p className={`mb-2 text-[0.62rem] font-bold tracking-widest ${col.tone}`}>{col.head}</p>
                        <ul className="space-y-1.5">
                          {col.rows.map((r, i) => (
                            <li key={r.symbol}>
                              <Link
                                to="/stock/$symbol"
                                params={{ symbol: r.symbol }}
                                className="grid grid-cols-[14px_1fr_auto] items-center gap-2 hover:text-primary"
                              >
                                <span className="num text-muted-foreground">{i + 1}</span>
                                <span className="truncate">{r.symbol}</span>
                                <span className="flex items-center gap-2">
                                  <LivePrice value={r.price} className="text-[0.7rem]" />
                                  <Delta value={r.changePct} />
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Sector Heatmap" action={<span className="text-[0.6rem] text-muted-foreground">MARKET CAP</span>}>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SECTOR_PERF.map((s, i) => {
                      const up = s.pct >= 0;
                      const inten = Math.min(1, Math.abs(s.pct) / 1.2);
                      return (
                        <div
                          key={s.name}
                          className={`rounded p-2 text-center transition hover:scale-[1.05] ${i < 4 ? "col-span-2" : i < 8 ? "col-span-2 2xl:col-span-1" : ""}`}
                          style={{
                            background: `color-mix(in oklab, ${up ? "var(--bull)" : "var(--bear)"} ${16 + inten * 58}%, transparent)`,
                          }}
                        >
                          <p className="truncate text-[0.6rem] font-semibold tracking-wide uppercase">{s.name}</p>
                          <p className="num text-sm font-bold">
                            {up ? "+" : ""}
                            {s.pct.toFixed(2)}%
                          </p>
                          <p className="num text-[0.58rem] text-foreground/70">{s.cap}</p>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 2xl:grid-cols-3">
                <Panel title="Market Breadth">
                  <div className="grid grid-cols-4 gap-2">
                    {BREADTH.map((b) => {
                      const pct = b.adv / (b.adv + b.dec);
                      const r = 26;
                      const c = 2 * Math.PI * r;
                      return (
                        <div key={b.label} className="text-center">
                          <p className="mb-1 text-[0.55rem] tracking-widest text-muted-foreground uppercase">{b.label}</p>
                          <div className="relative mx-auto size-[62px]">
                            <svg viewBox="0 0 62 62" className="-rotate-90">
                              <circle cx="31" cy="31" r={r} fill="none" stroke="var(--bear)" strokeWidth="5" opacity="0.5" />
                              <circle
                                cx="31"
                                cy="31"
                                r={r}
                                fill="none"
                                stroke="var(--bull)"
                                strokeWidth="5"
                                strokeDasharray={c}
                                strokeDashoffset={c * (1 - pct)}
                                strokeLinecap="round"
                                style={{ transition: "stroke-dashoffset 1s ease" }}
                              />
                            </svg>
                            <span className="num absolute inset-0 grid place-items-center text-xs font-bold text-bull">
                              {b.adv}
                            </span>
                          </div>
                          <p className="num text-[0.6rem] text-bear">{b.dec} declines</p>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel title="FII / DII Activity (₹ Cr)">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">
                        <th className="text-left font-medium">Flow</th>
                        <th className="text-right font-medium">22 May</th>
                        <th className="text-right font-medium">23 May</th>
                        <th className="text-right font-medium">MTD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {FLOWS.map((f) => (
                        <tr key={f.label}>
                          <td className="py-2 text-[0.68rem]">{f.label}</td>
                          {[f.a, f.b, f.c].map((v, i) => (
                            <td key={i} className={`num py-2 text-right ${v >= 0 ? "text-bull" : "text-bear"}`}>
                              {v.toLocaleString("en-IN")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>

                <Panel title="Global Indices">
                  <ul className="divide-y divide-border/60 text-xs">
                    {INDICES.slice(6).map((g) => (
                      <li key={g.symbol} className="flex items-center justify-between py-2">
                        <span className="tracking-wide uppercase">{g.symbol}</span>
                        <span className="flex items-center gap-3">
                          <LivePrice value={g.price} className="text-[0.72rem]" />
                          <Delta value={g.changePct} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>

            {/* AI brief rail */}
            <div className="space-y-4">
              <Panel title="AI Daily Brief" action={<span className="rounded bg-accent/20 px-2 py-0.5 text-[0.55rem] font-bold text-accent">BETA</span>}>
                <div className="scan-line rounded-md border border-primary/25 bg-primary/5 p-3">
                  <p className="text-xs font-bold tracking-widest text-primary uppercase">Market Outlook</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Global cues are mildly positive with U.S. futures trading higher. Nifty likely to open flat to
                    positive with support at 24,500 and resistance at 24,900. Banking and IT may lead.
                  </p>
                </div>
                <p className="mt-4 text-[0.62rem] font-bold tracking-widest text-primary uppercase">Key Insights</p>
                <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                  {[
                    "FII flows turned positive: +₹1,245 Cr (23 May)",
                    "Bank Nifty holding above key EMA support",
                    "IT stocks showing relative strength",
                    "Crude oil easing; INR stable",
                    "Earnings in focus: HDFC Bank, Infosys, NTPC",
                  ].map((k) => (
                    <li key={k} className="flex gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      {k}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/stock/$symbol"
                  params={{ symbol: "RELIANCE" }}
                  className="mt-4 flex items-center justify-between rounded-md border border-primary/40 px-4 py-3 text-xs font-bold tracking-widest text-primary uppercase transition hover:bg-primary/10"
                >
                  View full report <span>→</span>
                </Link>
              </Panel>

              <Panel title="News Flow">
                <ul className="space-y-3">
                  {NEWS.map((n) => (
                    <li key={n.title} className="border-l-2 pl-3" style={{ borderColor: n.tone === "positive" ? "var(--bull)" : n.tone === "negative" ? "var(--bear)" : "var(--border)" }}>
                      <p className="text-xs leading-snug">{n.title}</p>
                      <p className="mt-1 text-[0.6rem] text-muted-foreground">
                        {n.ago} · {n.src}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
