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
          <TickerTape />

          {active === "Dashboard" && <DashboardView />}
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
  const gainers = [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...quotes].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {INDICES.slice(0, 4).map((i) => {
          const series = candles(i.symbol, 40, i.price).map((c) => c.c);
          return (
            <Panel key={i.symbol} className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.62rem] font-bold tracking-widest text-muted-foreground uppercase">{i.symbol}</span>
                <Delta value={i.changePct} />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <LivePrice value={i.price} className="text-xl font-bold" />
                <span className="num text-[0.65rem] text-muted-foreground">LIVE</span>
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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Total Portfolio Value">
          <p className="num text-2xl font-extrabold text-primary">₹24,85,600 INR</p>
          <p className="text-xs text-bull mt-1">+₹4,12,300 (+19.8% All-Time)</p>
        </Panel>
        <Panel title="Day Profit & Loss">
          <p className="num text-2xl font-extrabold text-bull">+₹18,420 INR</p>
          <p className="text-xs text-bull mt-1">+0.75% Today</p>
        </Panel>
        <Panel title="Asset Allocation">
          <p className="text-xs text-muted-foreground">Equity: <strong className="text-foreground">65%</strong> | Cash: <strong className="text-foreground">20%</strong> | Gold: <strong className="text-foreground">15%</strong></p>
        </Panel>
      </div>

      <Panel title="Active Holdings Ledger">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border text-[0.68rem] uppercase">
              <th className="py-2 text-left">Stock</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Avg Price</th>
              <th className="py-2 text-right">Current</th>
              <th className="py-2 text-right">Total Value</th>
              <th className="py-2 text-right">Unrealized P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            <tr><td>RELIANCE</td><td className="text-right num">150</td><td className="text-right num">₹2,420</td><td className="text-right num">₹2,856.45</td><td className="text-right num">₹4,28,467</td><td className="text-right num text-bull font-bold">+₹65,467 (+18.0%)</td></tr>
            <tr><td>TCS</td><td className="text-right num">80</td><td className="text-right num">₹3,810</td><td className="text-right num">₹4,217.65</td><td className="text-right num">₹3,37,412</td><td className="text-right num text-bull font-bold">+₹32,612 (+10.7%)</td></tr>
            <tr><td>HDFCBANK</td><td className="text-right num">200</td><td className="text-right num">₹1,520</td><td className="text-right num">₹1,734.50</td><td className="text-right num">₹3,46,900</td><td className="text-right num text-bull font-bold">+₹42,900 (+14.1%)</td></tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* =========================================================================
   5. ORDERS VIEW
   ========================================================================= */
function OrdersView() {
  const [sym, setSym] = useState("RELIANCE");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(10);
  const [msg, setMsg] = useState("");

  const submitOrder = () => {
    setMsg(`Order Executed: ${side} ${qty} shares of ${sym} @ Market Price!`);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Interactive Order Execution Ticket">
        <div className="space-y-3 text-xs">
          <div className="flex gap-2">
            <button onClick={() => setSide("BUY")} className={`flex-1 py-2 font-bold rounded ${side === "BUY" ? "bg-bull text-white" : "bg-secondary"}`}>BUY</button>
            <button onClick={() => setSide("SELL")} className={`flex-1 py-2 font-bold rounded ${side === "SELL" ? "bg-bear text-white" : "bg-secondary"}`}>SELL</button>
          </div>

          <div>
            <label className="text-muted-foreground uppercase text-[0.62rem]">Symbol</label>
            <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} className="w-full rounded border border-border bg-secondary p-2 mt-1" />
          </div>

          <div>
            <label className="text-muted-foreground uppercase text-[0.62rem]">Quantity</label>
            <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded border border-border bg-secondary p-2 mt-1" />
          </div>

          <button onClick={submitOrder} className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded uppercase">
            Execute Order
          </button>

          {msg && <p className="p-2 bg-bull/15 text-bull rounded text-center font-bold">{msg}</p>}
        </div>
      </Panel>

      <Panel title="Execution Log">
        <div className="space-y-2 text-xs">
          <div className="p-2 border border-border/60 rounded flex justify-between">
            <span>BUY 50 RELIANCE @ ₹2,840</span>
            <span className="text-bull font-bold">FILLED</span>
          </div>
          <div className="p-2 border border-border/60 rounded flex justify-between">
            <span>BUY 20 TCS @ ₹4,180</span>
            <span className="text-bull font-bold">FILLED</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================================
   6. POSITIONS VIEW
   ========================================================================= */
function PositionsView() {
  return (
    <Panel title="Open Derivative & Equity Positions">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border text-[0.68rem] uppercase">
            <th className="py-2 text-left">Instrument</th>
            <th className="py-2 text-right">Type</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Entry</th>
            <th className="py-2 text-right">LTP</th>
            <th className="py-2 text-right">Unrealized P&L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          <tr><td>NIFTY 24800 CE</td><td className="text-right text-bull font-bold">CALL</td><td className="text-right num">100</td><td className="text-right num">₹125.40</td><td className="text-right num">₹148.20</td><td className="text-right num text-bull font-bold">+₹2,280 (+18.1%)</td></tr>
          <tr><td>RELIANCE FUT</td><td className="text-right text-bull font-bold">LONG</td><td className="text-right num">250</td><td className="text-right num">₹2,810.00</td><td className="text-right num">₹2,856.45</td><td className="text-right num text-bull font-bold">+₹11,612 (+1.6%)</td></tr>
        </tbody>
      </table>
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
   11. SETTINGS VIEW
   ========================================================================= */
function SettingsView() {
  return (
    <Panel title="Terminal Customization & API Preferences">
      <div className="space-y-4 text-xs max-w-md">
        <div>
          <label className="font-bold text-muted-foreground uppercase text-[0.62rem]">AI Model Engine</label>
          <input value="Groq Llama 3.3 70B (Direct API)" readOnly className="w-full rounded border border-border bg-secondary p-2 mt-1 font-mono" />
        </div>
        <div>
          <label className="font-bold text-muted-foreground uppercase text-[0.62rem]">Default Currency</label>
          <select className="w-full rounded border border-border bg-secondary p-2 mt-1">
            <option>INR (₹)</option>
            <option>USD ($)</option>
          </select>
        </div>
      </div>
    </Panel>
  );
}
