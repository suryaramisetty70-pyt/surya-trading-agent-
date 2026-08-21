import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useState } from "react";
import { MousePointerClick, Move3d, ZoomIn, Maximize2, Star, Share2, Orbit } from "lucide-react";
import { BASE_QUOTES, INDICES, SECTORS, SECTOR_COLOR, findQuote, fmt, useClock } from "@/lib/market";
import { Delta } from "@/components/market/primitives";

const GalaxyCanvas = lazy(() => import("@/components/market/GalaxyCanvas"));

export const Route = createFileRoute("/galaxy")({
  head: () => ({
    meta: [
      { title: "Market Galaxy — 3D Sector Constellation Map" },
      {
        name: "description",
        content:
          "Explore the market as a living galaxy: drag to rotate, scroll to zoom and click a star to inspect any stock's live price, volume and sector.",
      },
      { property: "og:title", content: "Market Galaxy — 3D Sector Constellation Map" },
      { property: "og:description", content: "An interactive 3D star map of market sectors and stocks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Galaxy,
});

function Galaxy() {
  const [sector, setSector] = useState("All Sectors");
  const [picked, setPicked] = useState<string | null>("RELIANCE");
  const clock = useClock();
  const onPick = useCallback((s: string | null) => setPicked(s), []);
  const q = picked ? findQuote(picked) : undefined;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#04060c]">
      <Suspense fallback={null}>
        <GalaxyCanvas activeSector={sector} onPick={onPick} />
      </Suspense>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="pointer-events-auto">
          <h1 className="font-display text-2xl font-light tracking-[0.4em] uppercase">Market Galaxy</h1>
          <p className="mt-1 flex items-center gap-2 text-[0.68rem] text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-bull" /> LIVE · {clock} IST
          </p>
          <Link to="/" className="mt-2 inline-block text-[0.65rem] tracking-widest text-primary uppercase hover:underline">
            ← Back to Agent
          </Link>
        </div>

        <div className="panel pointer-events-auto flex gap-6 px-5 py-3">
          {INDICES.slice(11).concat(INDICES[5] ? [INDICES[5]] : []).map((i) => (
            <div key={i.symbol}>
              <p className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">{i.symbol}</p>
              <p className="num text-sm font-semibold">{fmt(i.price, 2)}</p>
              <Delta value={i.changePct} />
            </div>
          ))}
        </div>
      </header>

      <aside className="absolute top-32 left-6 w-44 space-y-1">
        <p className="mb-2 text-[0.58rem] tracking-[0.2em] text-muted-foreground uppercase">Sectors</p>
        {["All Sectors", ...SECTORS].map((s) => (
          <button
            key={s}
            onClick={() => setSector(s)}
            className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-[0.7rem] transition ${
              sector === s
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <span className="size-2 rounded-full" style={{ background: SECTOR_COLOR[s] ?? "var(--primary)" }} />
            {s}
          </button>
        ))}
      </aside>

      {q && (
        <div className="panel absolute top-40 right-6 w-60 p-4 shadow-[var(--glow-cyan)]">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-primary/15 font-bold text-primary">
              {q.symbol[0]}
            </span>
            <div>
              <p className="text-sm font-semibold">{q.symbol}</p>
              <p className="text-[0.62rem] text-muted-foreground">{q.name}</p>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-[0.7rem]">
            {[
              ["Price", fmt(q.price)],
              ["Change", `${q.change >= 0 ? "+" : ""}${fmt(q.change)}`],
              ["Change %", `${q.changePct >= 0 ? "+" : ""}${q.changePct}%`],
              ["Volume", q.volume],
              ["Market Cap", q.marketCap],
              ["Sector", q.sector],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="tracking-wide text-muted-foreground uppercase">{k}</dt>
                <dd className={`num ${String(k).includes("Change") ? (q.changePct >= 0 ? "text-bull" : "text-bear") : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <Link
            to="/stock/$symbol"
            params={{ symbol: q.symbol }}
            className="mt-3 block rounded border border-primary/40 py-2 text-center text-[0.62rem] font-bold tracking-widest text-primary uppercase hover:bg-primary/10"
          >
            Open Terminal View
          </Link>
        </div>
      )}

      <div className="panel absolute bottom-6 left-6 w-64 p-4">
        <div className="flex justify-between text-[0.62rem]">
          <span className="tracking-widest text-muted-foreground uppercase">Market Volume</span>
          <span>Normal</span>
        </div>
        <div className="mt-2 flex h-10 items-end gap-[2px]">
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-primary/60"
              style={{
                height: `${(20 + Math.abs(Math.sin(i * 0.6)) * 70).toFixed(1)}%`,
                animationName: "float-y",
                animationDuration: `${(2 + (i % 5) * 0.4).toFixed(1)}s`,
                animationTimingFunction: "ease-in-out",
                animationDelay: `${(i * 0.03).toFixed(2)}s`,
                animationIterationCount: "infinite",
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.58rem] text-muted-foreground">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <div className="panel absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-6 px-6 py-3 text-[0.68rem] text-muted-foreground">
        <span className="flex items-center gap-2">
          <Move3d className="size-4 text-primary" /> Drag to rotate
        </span>
        <span className="flex items-center gap-2">
          <ZoomIn className="size-4 text-primary" /> Scroll to zoom
        </span>
        <span className="flex items-center gap-2">
          <MousePointerClick className="size-4 text-primary" /> Click a star to explore
        </span>
      </div>

      <div className="absolute right-6 bottom-6 flex gap-2">
        {[Orbit, Share2, Star, Maximize2].map((Icon, i) => (
          <button
            key={i}
            onClick={() => i === 3 && document.documentElement.requestFullscreen?.()}
            className={`grid size-10 place-items-center rounded-md border transition ${
              i === 0 ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 bg-background/60 hover:border-primary/40"
            }`}
            aria-label="Galaxy control"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <p className="sr-only">
        Sector clusters shown: {SECTORS.join(", ")}. Tracked symbols: {BASE_QUOTES.map((b) => b.symbol).join(", ")}.
      </p>
    </div>
  );
}
