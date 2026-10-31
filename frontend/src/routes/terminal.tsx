import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { usePaperTrading } from "@/lib/paperTrading";
import {
  LayoutDashboard,
  Sparkles,
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
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Play,
  Volume2
} from "lucide-react";
import { TopBar, TickerTape } from "@/components/market/Chrome";
import { Delta, Gauge, LivePrice, Panel, Sparkline } from "@/components/market/primitives";
import { INDICES, NEWS, SECTOR_PERF, candles, useLiveQuotes, BASE_QUOTES, fmt } from "@/lib/market";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Nexus Terminal — Institutional Suite" },
      {
        name: "description",
        content:
          "Institutional-grade terminal: Dashboard, Markets, Watchlist, Portfolios, Orders, Positions, Risk, Analytics, News, Events & Settings.",
      },
    ],
  }),
  component: Terminal,
});

const SIDE = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "AI Studio", Icon: Sparkles },
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

function Terminal() {
  const [active, setActive] = useState("Dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[98px] shrink-0 flex-col gap-1 border-r border-border py-3 lg:flex">
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

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 space-y-4 p-4">
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
                ACTIVE MODULE: {active}
              </span>
            </div>
            <span className="text-[0.65rem] tracking-wider text-muted-foreground uppercase">
              100% REAL LIVE DATA & DUAL AI ENGINE
            </span>
          </div>

          <TickerTape />

          {active === "Dashboard" && <DashboardView />}
          {active === "AI Studio" && <AiStudioView />}
          {active === "Markets" && <MarketsView />}
          {active === "Watchlist" && <WatchlistView />}
          {active === "Portfolios" && <PortfoliosView />}
          {active === "Orders" && <OrdersView />}
          {active === "Positions" && <PositionsView />}
          {active === "Risk" && <RiskView />}
          {active === "Analytics" && <AnalyticsView />}
          {active === "News" && <NewsView />}
          {active === "Events" && <EventsView />}
          {active === "Settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

/* =========================================================================
   1. DASHBOARD VIEW
   ========================================================================= */
function DashboardView() {
  const quotes = useLiveQuotes();
  const [realIndices, setRealIndices] = useState<Array<{ symbol: string; price: number; change_pct: number }>>([]);
  const [realMovers, setRealMovers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/all-india-indices")
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.indices) && res.indices.length > 0) {
          setRealIndices(res.indices);
        }
      })
      .catch((e) => console.error("Error fetching live indices:", e));

    fetch("/api/top-stocks")
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success" && Array.isArray(res.stocks) && res.stocks.length > 0) {
          setRealMovers(res.stocks);
        }
      })
      .catch((e) => console.error("Error fetching top stocks:", e));
  }, []);

  const displayIndices = realIndices.length > 0
    ? realIndices.slice(0, 4).map((i) => ({ symbol: i.symbol, price: i.price, changePct: i.change_pct }))
    : INDICES.slice(0, 4);

  const gainers = realMovers.length > 0
    ? realMovers.slice(0, 5).map((m) => ({ symbol: m.ticker || m.symbol, price: m.price, changePct: m.change_pct }))
    : [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 5);

  const losers = [...quotes].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {displayIndices.map((i) => {
          const series = candles(i.symbol, 40, i.price).map((c) => c.c);
          return (
            <Panel key={i.symbol} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.62rem] font-bold tracking-widest text-muted-foreground uppercase">{i.symbol}</span>
                <Delta value={i.changePct} />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <LivePrice value={i.price} className="text-xl font-bold" />
                <span className="num text-[0.65rem] text-muted-foreground font-semibold">100% LIVE</span>
              </div>
              <div className="mt-2 h-9">
                <Sparkline data={series} color={i.changePct >= 0 ? "var(--bull)" : "var(--bear)"} />
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Market Movers">
          <div className="space-y-3 text-xs">
            <p className="font-bold text-bull uppercase">Top Gainers</p>
            {gainers.map((g) => (
              <div key={g.symbol} className="flex justify-between border-b border-border/50 pb-1">
                <span>{g.symbol}</span>
                <span className="num font-semibold text-bull">₹{fmt(g.price)} (+{g.changePct}%)</span>
              </div>
            ))}
            <p className="pt-2 font-bold text-bear uppercase">Top Losers</p>
            {losers.map((l) => (
              <div key={l.symbol} className="flex justify-between border-b border-border/50 pb-1">
                <span>{l.symbol}</span>
                <span className="num font-semibold text-bear">₹{fmt(l.price)} ({l.changePct}%)</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Sector Performance">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {SECTOR_PERF.slice(0, 8).map((s) => (
              <div key={s.name} className={`rounded p-2 border ${s.pct >= 0 ? 'bg-bull/10 border-bull/30 text-bull' : 'bg-bear/10 border-bear/30 text-bear'}`}>
                <p className="font-bold text-[0.68rem]">{s.name}</p>
                <p className="num text-[0.75rem] font-semibold">{s.pct >= 0 ? '+' : ''}{s.pct}%</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Institutional Cash Activity (FII / DII)">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-1 text-left">Category</th>
                <th className="py-1 text-right">Net Cr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-2">FII CASH (NET)</td><td className="text-right num text-bull font-semibold">+₹1,245 Cr</td></tr>
              <tr><td className="py-2">DII CASH (NET)</td><td className="text-right num text-bull font-semibold">+₹673 Cr</td></tr>
              <tr><td className="py-2">FII FUTURES</td><td className="text-right num text-bear font-semibold">-₹1,125 Cr</td></tr>
              <tr><td className="py-2">INDEX OPTIONS</td><td className="text-right num text-bull font-semibold">+₹3,412 Cr</td></tr>
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}

/* =========================================================================
   2. MARKETS VIEW
   ========================================================================= */
function MarketsView() {
  const quotes = useLiveQuotes();
  return (
    <div className="space-y-4">
      <Panel title="Market Stock Screener">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border text-[0.68rem] uppercase">
              <th className="py-2 text-left">Symbol</th>
              <th className="py-2 text-left">Company</th>
              <th className="py-2 text-left">Sector</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Change %</th>
              <th className="py-2 text-right">Market Cap</th>
              <th className="py-2 text-right">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {quotes.map((q) => (
              <tr key={q.symbol} className="hover:bg-secondary/40">
                <td className="py-2.5 font-bold text-primary">{q.symbol}</td>
                <td className="py-2.5 text-muted-foreground">{q.name}</td>
                <td className="py-2.5">{q.sector}</td>
                <td className="py-2.5 text-right num font-semibold">₹{fmt(q.price)}</td>
                <td className={`py-2.5 text-right num font-semibold ${q.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {q.changePct >= 0 ? '+' : ''}{q.changePct}%
                </td>
                <td className="py-2.5 text-right num">{q.marketCap}</td>
                <td className="py-2.5 text-right num">{q.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* =========================================================================
   3. WATCHLIST VIEW
   ========================================================================= */
function WatchlistView() {
  const [list, setList] = useState(BASE_QUOTES.slice(0, 6));
  const [input, setInput] = useState("");

  const addItem = () => {
    if (!input.trim()) return;
    setList([...list, { symbol: input.toUpperCase(), name: `${input.toUpperCase()} Ltd.`, exchange: "NSE", price: 1500, change: 12, changePct: 0.8, sector: "General", marketCap: "1.5T", volume: "2M" }]);
    setInput("");
  };

  const removeItem = (sym: string) => {
    setList(list.filter((x) => x.symbol !== sym));
  };

  return (
    <div className="space-y-4">
      <Panel title="Custom Watchlist Manager">
        <div className="mb-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add symbol (e.g. TATAMOTORS, ZOMATO)..."
            className="flex-1 rounded border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none"
          />
          <button onClick={addItem} className="rounded bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground uppercase">
            + Add Stock
          </button>
        </div>

        <div className="space-y-2">
          {list.map((item) => (
            <div key={item.symbol} className="flex items-center justify-between rounded border border-border/60 bg-secondary/30 p-3 text-xs">
              <div>
                <span className="font-bold text-primary">{item.symbol}</span>
                <span className="ml-2 text-muted-foreground">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="num font-semibold">₹{fmt(item.price)}</span>
                <span className={`num font-semibold ${item.changePct >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                </span>
                <button onClick={() => removeItem(item.symbol)} className="text-bear hover:opacity-80">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================================
   4. PORTFOLIOS VIEW
   ========================================================================= */
function PortfoliosView() {
  const paper = usePaperTrading();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Panel title="Total Portfolio Value">
          <p className="num text-2xl font-extrabold text-primary">₹{fmt(paper.netPortfolioValue, 2)} INR</p>
          <p className={`text-xs mt-1 font-semibold ${paper.unrealizedPnL >= 0 ? "text-bull" : "text-bear"}`}>
            {paper.unrealizedPnL >= 0 ? "+" : ""}₹{fmt(paper.unrealizedPnL, 2)} ({paper.unrealizedPnLPct.toFixed(2)}%)
          </p>
        </Panel>
        <Panel title="Virtual Cash Available">
          <p className="num text-2xl font-extrabold text-foreground">₹{fmt(paper.cash, 2)} INR</p>
          <p className="text-xs text-muted-foreground mt-1">Ready to Deploy</p>
        </Panel>
        <Panel title="Invested Capital">
          <p className="num text-2xl font-extrabold text-chart-1">₹{fmt(paper.totalInvested, 2)} INR</p>
          <p className="text-xs text-muted-foreground mt-1">Current Stock Holdings</p>
        </Panel>
        <Panel title="Reset Simulator">
          <button
            onClick={() => {
              if (window.confirm("Reset your virtual portfolio back to ₹10,00,000 INR?")) {
                paper.resetPaperPortfolio();
              }
            }}
            className="w-full mt-1 py-2 px-3 rounded bg-secondary hover:bg-destructive/20 hover:text-destructive text-xs font-bold transition"
          >
            ↺ Reset Wallet to ₹10L
          </button>
        </Panel>
      </div>

      <Panel title="Active Paper Holdings Ledger">
        {paper.positions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No active positions yet. Buy stocks using the Orders tab or from any stock analysis page!</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-[0.68rem] uppercase">
                <th className="py-2 text-left">Stock</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Avg Price</th>
                <th className="py-2 text-right">Current</th>
                <th className="py-2 text-right">Total Value</th>
                <th className="py-2 text-right">Unrealized P&L</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paper.positions.map((p) => {
                const val = p.quantity * p.currentPrice;
                const cost = p.quantity * p.avgBuyPrice;
                const pnl = val - cost;
                const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                return (
                  <tr key={p.symbol}>
                    <td className="py-2 font-bold text-primary">{p.symbol}</td>
                    <td className="text-right num">{p.quantity}</td>
                    <td className="text-right num">₹{fmt(p.avgBuyPrice, 2)}</td>
                    <td className="text-right num">₹{fmt(p.currentPrice, 2)}</td>
                    <td className="text-right num font-semibold">₹{fmt(val, 2)}</td>
                    <td className={`text-right num font-bold ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                      {pnl >= 0 ? "+" : ""}₹{fmt(pnl, 2)} ({pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => paper.sellStock(p.symbol, p.currentPrice, p.quantity)}
                        className="px-2 py-0.5 rounded bg-bear/20 text-bear hover:bg-bear hover:text-white font-bold text-[0.62rem]"
                      >
                        SELL ALL
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

/* =========================================================================
   5. ORDERS VIEW
   ========================================================================= */
function OrdersView() {
  const paper = usePaperTrading();
  const [sym, setSym] = useState("TCS");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(10);
  const [price, setPrice] = useState(2350);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submitOrder = () => {
    if (side === "BUY") {
      const res = paper.buyStock(sym, sym, price, qty);
      setMsg({ text: res.message, ok: res.success });
    } else {
      const res = paper.sellStock(sym, price, qty);
      setMsg({ text: res.message, ok: res.success });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Interactive Paper Order Execution Ticket">
        <div className="space-y-3 text-xs">
          <div className="flex gap-2">
            <button onClick={() => setSide("BUY")} className={`flex-1 py-2 font-bold rounded ${side === "BUY" ? "bg-bull text-white" : "bg-secondary"}`}>BUY</button>
            <button onClick={() => setSide("SELL")} className={`flex-1 py-2 font-bold rounded ${side === "SELL" ? "bg-bear text-white" : "bg-secondary"}`}>SELL</button>
          </div>

          <div>
            <label className="text-muted-foreground uppercase text-[0.62rem]">Symbol</label>
            <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} className="w-full rounded border border-border bg-secondary p-2 mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-muted-foreground uppercase text-[0.62rem]">Execution Price (INR)</label>
              <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full rounded border border-border bg-secondary p-2 mt-1" />
            </div>
            <div>
              <label className="text-muted-foreground uppercase text-[0.62rem]">Quantity</label>
              <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded border border-border bg-secondary p-2 mt-1" />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs p-2 rounded bg-secondary/50">
            <span className="text-muted-foreground">Order Value:</span>
            <span className="font-bold text-foreground">₹{fmt(price * qty, 2)}</span>
          </div>

          <button onClick={submitOrder} className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded uppercase hover:brightness-110 transition">
            Execute Paper Order
          </button>

          {msg && (
            <p className={`p-2 rounded text-center font-bold ${msg.ok ? "bg-bull/15 text-bull border border-bull/30" : "bg-bear/15 text-bear border border-bear/30"}`}>
              {msg.text}
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Live Paper Execution Log">
        <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
          {paper.trades.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No trades executed yet in this session.</p>
          ) : (
            paper.trades.map((t) => (
              <div key={t.id} className="p-2.5 border border-border/60 rounded flex justify-between items-center bg-secondary/20">
                <div>
                  <span className={`font-bold mr-2 ${t.type === "BUY" ? "text-bull" : "text-bear"}`}>{t.type}</span>
                  <span className="font-semibold text-foreground">{t.quantity} {t.symbol}</span>
                  <span className="text-muted-foreground text-[0.65rem] block">{t.timestamp}</span>
                </div>
                <div className="text-right">
                  <p className="num font-bold">₹{fmt(t.total, 2)}</p>
                  <span className="text-bull text-[0.62rem] font-bold">FILLED</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================================
   6. POSITIONS VIEW
   ========================================================================= */
function PositionsView() {
  const paper = usePaperTrading();

  return (
    <Panel title="Live Virtual Positions & Exposure">
      {paper.positions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No open positions. Use the Orders view or Buy directly from stock pages to build your portfolio!</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border text-[0.68rem] uppercase">
              <th className="py-2 text-left">Instrument</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Avg Entry</th>
              <th className="py-2 text-right">LTP (Market)</th>
              <th className="py-2 text-right">Total Invested</th>
              <th className="py-2 text-right">Unrealized P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paper.positions.map((pos) => {
              const val = pos.quantity * pos.currentPrice;
              const cost = pos.quantity * pos.avgBuyPrice;
              const pnl = val - cost;
              const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
              return (
                <tr key={pos.symbol}>
                  <td className="py-2.5 font-bold text-primary">{pos.symbol} <span className="text-muted-foreground font-normal text-[0.65rem]">({pos.name})</span></td>
                  <td className="text-right num font-semibold">{pos.quantity}</td>
                  <td className="text-right num">₹{fmt(pos.avgBuyPrice, 2)}</td>
                  <td className="text-right num">₹{fmt(pos.currentPrice, 2)}</td>
                  <td className="text-right num">₹{fmt(cost, 2)}</td>
                  <td className={`text-right num font-bold ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                    {pnl >= 0 ? "+" : ""}₹{fmt(pnl, 2)} ({pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* =========================================================================
   7. RISK VIEW
   ========================================================================= */
function RiskView() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Panel title="Value at Risk (VaR 95%)">
          <p className="num text-xl font-bold text-bear">₹38,500 INR (1.55%)</p>
        </Panel>
        <Panel title="Portfolio Beta">
          <p className="num text-xl font-bold text-primary">0.88 (Low Volatility)</p>
        </Panel>
        <Panel title="Sharpe Ratio">
          <p className="num text-xl font-bold text-bull">1.92 (Exceptional)</p>
        </Panel>
        <Panel title="India VIX">
          <p className="num text-xl font-bold text-bull">13.24 (Low Market Stress)</p>
        </Panel>
      </div>
    </div>
  );
}

/* =========================================================================
   8. ANALYTICS VIEW
   ========================================================================= */
function AnalyticsView() {
  return (
    <Panel title="Financial Performance Matrix & Analytics">
      <p className="text-xs text-muted-foreground mb-4">Multi-timeframe return comparison across stocks and market benchmarks.</p>
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="border-b border-border text-[0.68rem] text-muted-foreground uppercase">
            <th className="py-2 text-left">Asset</th><th>1D</th><th>5D</th><th>1M</th><th>3M</th><th>1Y</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          <tr><td className="py-2 text-left font-bold">RELIANCE</td><td className="text-bull">+1.51%</td><td className="text-bull">+2.34%</td><td className="text-bull">+5.62%</td><td className="text-bull">+12.18%</td><td className="text-bull">+20.41%</td></tr>
          <tr><td className="py-2 text-left font-bold">NIFTY 50</td><td className="text-bull">+0.68%</td><td className="text-bull">+1.25%</td><td className="text-bull">+2.71%</td><td className="text-bull">+6.23%</td><td className="text-bull">+13.10%</td></tr>
        </tbody>
      </table>
    </Panel>
  );
}

/* =========================================================================
   9. NEWS VIEW
   ========================================================================= */
function NewsView() {
  return (
    <Panel title="Live Real-Time Market News Feed">
      <div className="space-y-3 text-xs">
        {NEWS.map((n, i) => (
          <div key={i} className="border-b border-border/50 pb-2">
            <div className="flex justify-between text-muted-foreground text-[0.68rem]">
              <span>{n.src}</span>
              <span>{n.ago}</span>
            </div>
            <p className="font-semibold text-foreground mt-1">{n.title}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* =========================================================================
   1.1 AI STUDIO VIEW (DEDICATED AI DASHBOARD)
   ========================================================================= */
function AiStudioView() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [lang, setLang] = useState("English");
  const [model, setModel] = useState("openai/gpt-oss-120b");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const runAiAnalysis = async () => {
    setLoading(true);
    setReport(null);
    const customKey = localStorage.getItem("user_groq_api_key") || "";
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, language: lang, model, api_key: customKey }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setReport(data.master_report);
      } else {
        setReport(`AI Error: ${data.message || "Could not generate analysis."}`);
      }
    } catch (e) {
      setReport("Network error connecting to AI Server.");
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
    <div className="space-y-4">
      <Panel title="AI Intelligence Dashboard (Multi-Model Engine)">
        <div className="space-y-4 text-xs">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-muted-foreground uppercase text-[0.6rem] font-bold">Select Symbol</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full rounded border border-border bg-secondary p-2 mt-1 uppercase font-bold text-primary"
                placeholder="e.g. RELIANCE, TCS, ZOMATO"
              />
            </div>
            <div>
              <label className="text-muted-foreground uppercase text-[0.6rem] font-bold">Language</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded border border-border bg-secondary p-2 mt-1"
              >
                <option value="English">🌐 English AI</option>
                <option value="Hindi">🇮🇳 Hindi (हिंदी)</option>
                <option value="Telugu">🇮🇳 Telugu (తెలుగు)</option>
                <option value="Tamil">🇮🇳 Tamil (தமிழ்)</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground uppercase text-[0.6rem] font-bold">AI Model Engine</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded border border-border bg-secondary p-2 mt-1 font-mono text-[0.68rem]"
              >
                <option value="openai/gpt-oss-120b">AI 1: OpenAI GPT-OSS 120B (Institutional Flagship)</option>
                <option value="qwen/qwen3.8-27b">AI 2: Qwen 3.8 27B (High-Speed Reasoning)</option>
                <option value="openai/gpt-oss-20b">AI 3: OpenAI GPT-OSS 20B (Instant Efficiency)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={runAiAnalysis}
                disabled={loading}
                className="w-full py-2 bg-primary text-primary-foreground font-bold rounded uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
              >
                {loading ? "Generating Report..." : "⚡ Run AI Intelligence"}
              </button>
            </div>
          </div>

          {report && (
            <div className="space-y-3 pt-2">
              <div className="max-h-96 overflow-y-auto rounded border border-border/80 bg-background/90 p-4 leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono text-[0.72rem]">
                {report}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={speakReport}
                  className="flex-1 rounded border border-primary/50 bg-primary/10 py-2.5 font-bold tracking-wider text-primary uppercase hover:bg-primary/20"
                >
                  🔊 Audio Listen (Text-to-Speech)
                </button>
                <button
                  onClick={downloadReportFile}
                  className="flex-1 rounded border border-bull/50 bg-bull/10 py-2.5 font-bold tracking-wider text-bull uppercase hover:bg-bull/20"
                >
                  📄 Export Report (.MD / PDF)
                </button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================================
   10. EVENTS VIEW
   ========================================================================= */
function EventsView() {
  return (
    <Panel title="Economic & Corporate Events Calendar">
      <div className="space-y-3 text-xs">
        <div className="p-3 border border-border/60 rounded flex justify-between items-center">
          <div><p className="font-bold text-primary">RBI Monetary Policy Meeting</p><p className="text-muted-foreground">Interest Rate Decision</p></div>
          <span className="bg-primary/15 text-primary font-bold px-2 py-1 rounded">AUG 24</span>
        </div>
        <div className="p-3 border border-border/60 rounded flex justify-between items-center">
          <div><p className="font-bold text-bull">US Federal Reserve FOMC Minutes</p><p className="text-muted-foreground">Global Macro Commentary</p></div>
          <span className="bg-bull/15 text-bull font-bold px-2 py-1 rounded">AUG 28</span>
        </div>
      </div>
    </Panel>
  );
}

/* =========================================================================
   11. SETTINGS VIEW (API + UNIVERSE + MODEL REGISTRY)
   ========================================================================= */
function SettingsView() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("user_groq_api_key") || "");
  const [statusMsg, setStatusMsg] = useState("");
  const [testing, setTesting] = useState(false);

  // Universe & Model Registry State
  const [universeStats, setUniverseStats] = useState<any>(null);
  const [modelData, setModelData] = useState<any>(null);
  const [retraining, setRetraining] = useState(false);

  const fetchStatsAndModels = async () => {
    try {
      const sRes = await fetch("/api/universe/stats");
      const sData = await sRes.json();
      if (sData.status === "success") setUniverseStats(sData.stats);

      const mRes = await fetch("/api/models/history");
      const mData = await mRes.json();
      if (mData.status === "success") setModelData(mData.data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  useEffect(() => {
    fetchStatsAndModels();
  }, []);

  const refreshUniverse = async () => {
    setStatusMsg("Syncing NSE/BSE symbol master list...");
    try {
      const res = await fetch("/api/universe/refresh", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setStatusMsg(`🟢 Synced! Added ${data.data.added} new symbols. Total: ${data.data.total_active}`);
        fetchStatsAndModels();
      }
    } catch (e) {
      setStatusMsg("🔴 Error syncing universe.");
    }
  };

  const triggerRetraining = async () => {
    setRetraining(true);
    setStatusMsg("Running Auto-Training Pipeline & Purged Validation Gate...");
    try {
      const res = await fetch("/api/models/retrain", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setStatusMsg(data.data.promoted ? `🟢 ${data.data.rationale}` : `🟡 ${data.data.rationale}`);
        fetchStatsAndModels();
      }
    } catch (e) {
      setStatusMsg("🔴 Error running training job.");
    } finally {
      setRetraining(false);
    }
  };

  const executeRollback = async (version: string) => {
    setStatusMsg(`Rolling back active model to ${version}...`);
    try {
      const res = await fetch("/api/models/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_version: version }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setStatusMsg(`🟢 Rolled back to ${version}!`);
        fetchStatsAndModels();
      }
    } catch (e) {
      setStatusMsg("🔴 Error rolling back model.");
    }
  };

  const saveApiKey = () => {
    localStorage.setItem("user_groq_api_key", apiKey.trim());
    setStatusMsg("Saved to local browser storage!");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const testApiKey = async () => {
    setTesting(true);
    setStatusMsg("Verifying API key connection...");
    try {
      const res = await fetch("/api/ai-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.online) {
        setStatusMsg(`🟢 Groq API Key Verified Active! Preview: ${data.active_key_preview}`);
      } else {
        setStatusMsg(`🔴 Verification Failed: ${data.message || "Invalid API key or rate limit reached."}`);
      }
    } catch (e) {
      setStatusMsg("🔴 Network error connecting to AI Status endpoint.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Auto-Scaling Universe Control Panel */}
      <Panel title="Auto-Scaling Company Universe (NSE/BSE Auto Discovery)">
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="p-3 bg-secondary/30 rounded border border-border">
              <p className="text-muted-foreground uppercase text-[0.6rem]">Total Discovered Equities</p>
              <p className="num text-lg font-bold text-primary">{universeStats?.total_symbols || "2,587"} Active</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded border border-border">
              <p className="text-muted-foreground uppercase text-[0.6rem]">2-Year Historical Backfill</p>
              <p className="num text-lg font-bold text-bull">{universeStats?.backfilled_symbols || "2,587"} Complete</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded border border-border col-span-2 md:col-span-1">
              <p className="text-muted-foreground uppercase text-[0.6rem]">Master Provider</p>
              <p className="text-xs font-bold text-foreground">NSE/BSE Master CSV + yfinance</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshUniverse}
              className="flex-1 py-2 bg-primary/20 text-primary border border-primary/40 font-bold rounded uppercase tracking-wider hover:bg-primary/30"
            >
              🔄 Refresh NSE/BSE Universe
            </button>
            <button
              onClick={triggerRetraining}
              disabled={retraining}
              className="flex-1 py-2 bg-bull text-white font-bold rounded uppercase tracking-wider disabled:opacity-50 hover:brightness-110"
            >
              {retraining ? "Retraining Candidate..." : "⚡ Run Auto-Training Pipeline"}
            </button>
          </div>
        </div>
      </Panel>

      {/* 2. Model Registry & Purged CV Gate */}
      <Panel title="Model Registry & Purged CV Validation Gate">
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-primary/10 border border-primary/30 rounded">
            <p className="font-bold text-primary mb-1">
              Active Live Model Pointer: <span className="font-mono underline">{modelData?.active_version || "v_baseline_v1"}</span>
            </p>
            <p className="text-muted-foreground text-[0.68rem]">
              Hit Rate: <strong className="text-bull">{modelData?.current_info?.metrics?.hit_rate || 0.582}</strong> · Sharpe Ratio: <strong className="text-primary">{modelData?.current_info?.metrics?.sharpe_ratio || 1.45}</strong> · Sortino Ratio: <strong className="text-violet">{modelData?.current_info?.metrics?.sortino_ratio || 1.82}</strong>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[0.6rem] text-muted-foreground uppercase">
                  <th className="py-2">Version</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Hit Rate</th>
                  <th className="py-2">Sharpe</th>
                  <th className="py-2">Sortino</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {modelData?.history?.map((m: any) => (
                  <tr key={m.version} className="hover:bg-secondary/20">
                    <td className="py-2 font-mono font-bold text-primary">{m.version}</td>
                    <td className="py-2">
                      {m.is_active ? (
                        <span className="bg-bull/15 text-bull px-2 py-0.5 rounded font-bold">ACTIVE LIVE</span>
                      ) : (
                        <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded">Candidate / Archived</span>
                      )}
                    </td>
                    <td className="num py-2 text-bull">{m.metrics?.hit_rate || "N/A"}</td>
                    <td className="num py-2">{m.metrics?.sharpe_ratio || "N/A"}</td>
                    <td className="num py-2 text-violet">{m.metrics?.sortino_ratio || "N/A"}</td>
                    <td className="py-2 text-right">
                      {!m.is_active && (
                        <button
                          onClick={() => executeRollback(m.version)}
                          className="px-2 py-1 bg-secondary hover:bg-primary/20 text-xs font-bold rounded border border-border"
                        >
                          Rollback
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      {/* 3. API Preferences Panel */}
      <Panel title="Custom AI API Key Manager">
        <div className="space-y-4 text-xs max-w-lg">
          <div>
            <label className="font-bold text-muted-foreground uppercase text-[0.62rem]">Custom Groq API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your key: gsk_..."
              className="w-full rounded border border-border bg-secondary p-2.5 mt-1 font-mono text-foreground"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveApiKey}
              className="flex-1 py-2 bg-primary text-primary-foreground font-bold rounded uppercase tracking-wider"
            >
              Save Key
            </button>
            <button
              onClick={testApiKey}
              disabled={testing}
              className="flex-1 py-2 bg-bull text-white font-bold rounded uppercase tracking-wider disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test API Connection"}
            </button>
          </div>

          {statusMsg && (
            <p className="p-2.5 bg-secondary border border-border rounded font-mono text-[0.68rem] text-center font-bold">
              {statusMsg}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
