import { Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Search, Bell, Star, User, Radio, CheckCircle2, ShieldCheck, Wallet, ArrowDownCircle, ArrowUpCircle, Settings, X, ExternalLink } from "lucide-react";
import { BASE_QUOTES, INDICES, useClock, useLiveQuotes, fmt } from "@/lib/market";
import { Delta, LivePrice } from "./primitives";
import { cn } from "@/lib/utils";
import { useUserAccount } from "@/lib/userAccount";
import { usePaperTrading } from "@/lib/paperTrading";

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [depositMsg, setDepositMsg] = useState("");

  const navigate = useNavigate();
  const { profile, notifications, unreadCount, markAllNotificationsRead } = useUserAccount();
  const paper = usePaperTrading();

  const results = q
    ? BASE_QUOTES.filter(
        (s) => s.symbol.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 6)
    : [];

  const handleDepositQuick = (amount: number) => {
    const res = paper.depositCash(amount);
    setDepositMsg(res.message);
    setTimeout(() => setDepositMsg(""), 3000);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/15 font-display text-lg font-bold text-primary shadow-[var(--glow-cyan)]">
            S
          </span>
          <span className="font-display text-sm font-semibold tracking-[0.22em] uppercase">Surya</span>
        </Link>

        <div className="relative min-w-[180px] flex-1">
          <button
            type="button"
            onClick={() => {
              if (q.trim()) {
                const query = q.trim().toUpperCase();
                navigate({ to: "/stock/$symbol", params: { symbol: query } });
                setOpen(false);
              }
            }}
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground hover:text-primary transition"
          >
            <Search className="size-4" />
          </button>
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
            <ul className="panel absolute top-full left-0 z-50 mt-2 w-full overflow-hidden p-1 shadow-2xl">
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
          {/* Live Market Clock */}
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

          {/* Notifications Button & Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotifsOpen(!notifsOpen);
                setAccountOpen(false);
                setWatchlistOpen(false);
                if (!notifsOpen) markAllNotificationsRead();
              }}
              className="relative grid size-9 place-items-center rounded-md border border-border hover:border-primary/50 transition bg-secondary/30"
              aria-label="Alerts"
            >
              <Bell className="size-4 text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-xs">
                  <span className="font-bold uppercase tracking-wider text-primary">Alerts & Notifications</span>
                  <button onClick={() => setNotifsOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-2 rounded bg-secondary/50 border border-border/60 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-[0.72rem]">{n.title}</span>
                        <span className="text-[0.6rem] text-muted-foreground">{n.timestamp}</span>
                      </div>
                      <p className="text-[0.68rem] text-muted-foreground mt-0.5 leading-snug">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Watchlist Button */}
          <div className="relative">
            <button
              onClick={() => {
                setWatchlistOpen(!watchlistOpen);
                setAccountOpen(false);
                setNotifsOpen(false);
              }}
              className="grid size-9 place-items-center rounded-md border border-border hover:border-primary/50 transition bg-secondary/30"
              aria-label="Watchlist"
            >
              <Star className="size-4 text-foreground" />
            </button>

            {watchlistOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-popover p-3 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border text-xs">
                  <span className="font-bold uppercase tracking-wider text-primary">Quick Watchlist</span>
                  <button onClick={() => setWatchlistOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="size-3.5" />
                  </button>
                </div>
                <WatchlistPanel />
              </div>
            )}
          </div>

          {/* Account Profile Popover Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setAccountOpen(!accountOpen);
                setNotifsOpen(false);
                setWatchlistOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-primary/50 bg-primary/10 hover:bg-primary/20 transition"
              aria-label="Account"
            >
              <User className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-primary hidden sm:inline">{profile.clientId}</span>
            </button>

            {accountOpen && (
              <div className="absolute right-0 top-full mt-2 w-84 rounded-xl border border-border bg-popover p-4 shadow-2xl z-50 space-y-3">
                {/* Header profile info */}
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground text-xs shadow">
                      SR
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{profile.name}</p>
                      <p className="text-[0.65rem] text-muted-foreground font-mono">{profile.clientId}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[0.6rem] font-bold bg-bull/15 text-bull border border-bull/30 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> KYC OK
                  </span>
                </div>

                {/* Capital & Margin Snapshot */}
                <div className="p-3 bg-secondary/40 rounded-lg border border-border/80 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[0.65rem] text-muted-foreground uppercase font-semibold">Total Margin</span>
                    <span className="num font-bold text-primary text-sm">₹{fmt(paper.netPortfolioValue, 2)}</span>
                  </div>
                  <div className="flex justify-between text-[0.7rem]">
                    <span className="text-muted-foreground">Available Cash:</span>
                    <span className="num font-semibold text-foreground">₹{fmt(paper.cash, 2)}</span>
                  </div>
                  <div className="flex justify-between text-[0.7rem]">
                    <span className="text-muted-foreground">Invested Capital:</span>
                    <span className="num font-semibold text-foreground">₹{fmt(paper.totalInvested, 2)}</span>
                  </div>
                </div>

                {/* Quick Add Funds Buttons */}
                <div>
                  <span className="text-[0.62rem] text-muted-foreground uppercase block font-semibold mb-1.5">
                    Quick Virtual Capital Injection:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleDepositQuick(100000)}
                      className="py-1.5 px-2 rounded bg-primary/20 text-primary border border-primary/40 font-bold hover:bg-primary hover:text-primary-foreground transition text-center"
                    >
                      + ₹1,00,000
                    </button>
                    <button
                      onClick={() => handleDepositQuick(500000)}
                      className="py-1.5 px-2 rounded bg-bull/20 text-bull border border-bull/40 font-bold hover:bg-bull hover:text-white transition text-center"
                    >
                      + ₹5,00,000
                    </button>
                  </div>
                  {depositMsg && (
                    <p className="text-[0.65rem] text-bull font-bold text-center mt-1.5 bg-bull/10 py-1 rounded">
                      {depositMsg}
                    </p>
                  )}
                </div>

                {/* Links to Terminal Modules */}
                <div className="pt-2 border-t border-border flex flex-col gap-1 text-xs">
                  <Link
                    to="/terminal"
                    hash="Account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center justify-between p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-primary" /> Full Account & KYC Details
                    </span>
                    <ExternalLink className="size-3" />
                  </Link>
                  <Link
                    to="/terminal"
                    hash="Settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center justify-between p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="size-3.5 text-primary" /> Platform Settings & Broker APIs
                    </span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
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
