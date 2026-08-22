import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Bell, Star, User, Radio } from "lucide-react";
import { BASE_QUOTES, INDICES, useClock, useLiveQuotes } from "@/lib/market";
import { Delta, LivePrice } from "./primitives";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Agent" },
  { to: "/terminal", label: "Terminal" },
  { to: "/galaxy", label: "Galaxy" },
  { to: "/stock/$symbol", label: "Stock", params: { symbol: "RELIANCE" } },
] as const;

export function TopBar() {
  const clock = useClock();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const results = q
    ? BASE_QUOTES.filter(
        (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 6)
    : [];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/15 font-display text-lg font-bold text-primary shadow-[var(--glow-cyan)]">
            S
          </span>
          <span className="font-display text-sm font-semibold tracking-[0.22em] uppercase">Surya</span>
        </Link>

        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) {
                const query = q.trim().toUpperCase();
                navigate({ to: "/stock/$symbol", params: { symbol: query } });
                setOpen(false);
              }
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search markets, assets, news, or type company (e.g. Zomato, Reliance, Tesla)..."
            className="w-full rounded-md border border-border bg-secondary/60 py-2 pr-10 pl-9 text-sm outline-none transition focus:border-primary/60 focus:shadow-[var(--glow-cyan)]"
          />
          <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border border-border px-1.5 text-[0.65rem] text-muted-foreground">
            ↵
          </kbd>
          {open && results.length > 0 && (
            <ul className="panel absolute top-full left-0 z-50 mt-2 w-full overflow-hidden p-1">
              {results.map((r) => (
                <li key={r.symbol}>
                  <button
                    onMouseDown={() => navigate({ to: "/stock/$symbol", params: { symbol: r.symbol } })}
                    className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-medium">{r.symbol}</span>
                    <span className="truncate pl-3 text-xs text-muted-foreground">{r.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              {...("params" in n ? { params: n.params as never } : {})}
              activeProps={{ className: "text-primary bg-primary/10" }}
              className="rounded-md px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase transition hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-md border border-bull/40 bg-bull/10 px-3 py-1.5 md:flex">
            <span className="relative grid place-items-center">
              <Radio className="size-3.5 text-bull" />
              <span className="absolute size-3.5 rounded-full bg-bull/40 [animation:pulse-ring_1.8s_ease-out_infinite]" />
            </span>
            <div className="leading-tight">
              <p className="text-[0.6rem] font-bold tracking-widest text-bull">LIVE</p>
              <p className="num text-[0.6rem] text-muted-foreground">{clock} IST</p>
            </div>
          </div>
          <button className="grid size-9 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Alerts">
            <Bell className="size-4" />
          </button>
          <button className="grid size-9 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Watchlist">
            <Star className="size-4" />
          </button>
          <button className="grid size-9 place-items-center rounded-full border border-primary/50 bg-primary/10" aria-label="Account">
            <User className="size-4 text-primary" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function TickerTape({ className }: { className?: string }) {
  const [items] = useState(INDICES);
  const row = [...items, ...items];
  return (
    <div className={cn("panel relative flex items-stretch overflow-hidden", className)}>
      <div className="flex shrink-0 items-center gap-2 border-r border-border px-4">
        <span className="text-[0.62rem] font-bold tracking-[0.18em] text-primary uppercase">Live Market Ticker</span>
      </div>
      <div className="overflow-hidden">
        <div className="animate-marquee flex w-max">
          {row.map((i, idx) => (
            <TickerItem key={`${i.symbol}-${idx}`} symbol={i.symbol} price={i.price} pct={i.changePct} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TickerItem({ symbol, price, pct }: { symbol: string; price: number; pct: number }) {
  return (
    <div className="flex min-w-[190px] flex-col justify-center border-r border-border/60 px-5 py-2">
      <span className="text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">{symbol}</span>
      <span className="num text-sm font-semibold">
        {price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </span>
      <Delta value={pct} />
    </div>
  );
}

export function WatchlistPanel() {
  const quotes = useLiveQuotes().slice(0, 6);
  return (
    <div className="divide-y divide-border/70">
      {quotes.map((q) => (
        <Link
          key={q.symbol}
          to="/stock/$symbol"
          params={{ symbol: q.symbol }}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 transition hover:bg-secondary/40"
        >
          <div>
            <p className="text-sm font-semibold">{q.symbol}</p>
            <p className="text-[0.65rem] text-muted-foreground">{q.exchange}</p>
          </div>
          <LivePrice value={q.price} className="text-sm" />
          <Delta value={q.changePct} className="justify-self-end" />
        </Link>
      ))}
    </div>
  );
}
