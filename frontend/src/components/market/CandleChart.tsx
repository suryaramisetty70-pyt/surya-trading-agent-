import { useMemo, useState } from "react";
import { candles, ema, fmt } from "@/lib/market";

type CandleItem = { i: number; o: number; h: number; l: number; c: number; v: number; date?: string };
export type ProjectionItem = { day: number; label: string; expected: number; upper: number; lower: number };

export default function CandleChart({
  symbol,
  base,
  range = "1D",
  candlesData,
  projectionData,
}: {
  symbol: string;
  base: number;
  range?: string;
  candlesData?: CandleItem[];
  projectionData?: ProjectionItem[];
}) {
  const count = { "1D": 60, "5D": 80, "1M": 110, "3M": 140, "6M": 170, "1Y": 200, "5Y": 240, MAX: 260 }[range] ?? 120;
  const data = useMemo(() => {
    if (candlesData && candlesData.length > 5) {
      return candlesData;
    }
    return candles(symbol, count, base);
  }, [symbol, count, base, candlesData]);
  const [hover, setHover] = useState<number | null>(null);

  const W = 1000;
  const H = 420;
  const VH = 90;
  const pad = { l: 8, r: 74, t: 12, b: 8 };

  const projPoints = projectionData || [];
  const allHighs = [...data.map((d) => d.h), ...projPoints.map((p) => p.upper)];
  const allLows = [...data.map((d) => d.l), ...projPoints.map((p) => p.lower)];
  const hi = Math.max(...allHighs);
  const lo = Math.min(...allLows);
  const span = hi - lo || 1;
  const iw = W - pad.l - pad.r;
  const cw = iw / data.length;
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const closes = data.map((d) => d.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i ? "L" : "M"}${(pad.l + i * cw + cw / 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const maxV = Math.max(...data.map((d) => d.v));
  const active: CandleItem | undefined = hover != null ? data[hover] : undefined;
  const last = data[data.length - 1]!;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H + VH}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W - pad.l;
          setHover(Math.max(0, Math.min(data.length - 1, Math.floor(x / cw))));
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(lo + span * f)} y2={y(lo + span * f)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={W - pad.r + 8} y={y(lo + span * f) + 4} fill="var(--muted-foreground)" fontSize="12" className="num">
              {fmt(lo + span * f, 2)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = pad.l + i * cw + cw / 2;
          const up = d.c >= d.o;
          const col = up ? "var(--bull)" : "var(--bear)";
          return (
            <g key={i} opacity={hover == null || hover === i ? 1 : 0.85}>
              <line x1={x} x2={x} y1={y(d.h)} y2={y(d.l)} stroke={col} strokeWidth="1" />
              <rect
                x={x - cw * 0.32}
                width={cw * 0.64}
                y={y(Math.max(d.o, d.c))}
                height={Math.max(1, Math.abs(y(d.o) - y(d.c)))}
                fill={col}
              />
              <rect
                x={pad.l + i * cw}
                width={cw}
                y={H + VH - (d.v / maxV) * (VH - 12)}
                height={(d.v / maxV) * (VH - 12)}
                fill={col}
                opacity="0.45"
              />
            </g>
          );
        })}

        <path d={line(e20)} fill="none" stroke="var(--chart-1)" strokeWidth="1.6" opacity="0.9" />
        <path d={line(e50)} fill="none" stroke="oklch(0.7 0.12 230)" strokeWidth="1.6" opacity="0.8" />
        <path d={line(e200)} fill="none" stroke="var(--violetq)" strokeWidth="1.6" opacity="0.8" />

        <g>
          <rect x={W - pad.r} y={y(last.c) - 11} width={pad.r - 4} height="22" rx="3" fill="var(--bull)" />
          <text x={W - pad.r + 6} y={y(last.c) + 5} fontSize="12" fill="#04120c" className="num">
            {fmt(last.c, 2)}
          </text>
        </g>

        {/* ML 5-Day Forward Projection Cone */}
        {projPoints.length > 0 && (() => {
          const x0 = pad.l + (data.length - 1) * cw + cw / 2;
          const y0 = y(last.c);
          const upperPath = projPoints.map((p, i) => `${i === 0 ? "M" + x0 + "," + y0 + " L" : "L"}${(x0 + p.day * (cw * 2.2)).toFixed(1)},${y(p.upper).toFixed(1)}`).join(" ");
          const lowerPathRev = [...projPoints].reverse().map((p) => `L${(x0 + p.day * (cw * 2.2)).toFixed(1)},${y(p.lower).toFixed(1)}`).join(" ");
          const conePolygon = `${upperPath} ${lowerPathRev} Z`;
          const expectedLine = `${"M" + x0 + "," + y0} ` + projPoints.map((p) => `L${(x0 + p.day * (cw * 2.2)).toFixed(1)},${y(p.expected).toFixed(1)}`).join(" ");
          const lastProj = projPoints[projPoints.length - 1]!;
          const xEnd = x0 + lastProj.day * (cw * 2.2);

          return (
            <g>
              <defs>
                <linearGradient id="mlConeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path d={conePolygon} fill="url(#mlConeGrad)" stroke="var(--primary)" strokeDasharray="2 3" strokeWidth="1" opacity="0.6" />
              <path d={expectedLine} fill="none" stroke="var(--primary)" strokeDasharray="4 3" strokeWidth="2" />
              <circle cx={xEnd} cy={y(lastProj.expected)} r="4" fill="var(--primary)" />
              <rect x={Math.min(W - 130, xEnd + 6)} y={y(lastProj.expected) - 10} width="96" height="20" rx="3" fill="var(--primary)" />
              <text x={Math.min(W - 130, xEnd + 6) + 4} y={y(lastProj.expected) + 4} fontSize="10" fontWeight="bold" fill="#04120c">
                ML T+5d: ₹{fmt(lastProj.expected, 0)}
              </text>
            </g>
          );
        })()}

        {hover != null && active && (
          <g>
            <line
              x1={pad.l + hover * cw + cw / 2}
              x2={pad.l + hover * cw + cw / 2}
              y1={pad.t}
              y2={H + VH}
              stroke="var(--primary)"
              strokeDasharray="4 4"
              opacity="0.7"
            />
          </g>
        )}
      </svg>

      {hover != null && active && (
        <div className="panel pointer-events-none absolute top-4 left-[52%] w-40 p-3 text-xs">
          <p className="mb-1 text-[0.65rem] text-muted-foreground">Bar #{hover + 1}</p>
          {(["o", "h", "l", "c"] as const).map((k) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground uppercase">{k}</span>
              <span className="num">{fmt(active[k], 2)}</span>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-muted-foreground">V</span>
            <span className="num">{(active.v / 1e6).toFixed(2)}M</span>
          </div>
        </div>
      )}
    </div>
  );
}
