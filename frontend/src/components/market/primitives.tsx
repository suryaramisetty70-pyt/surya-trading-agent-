import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Delta({ value, suffix = "%", className }: { value: number; suffix?: string; className?: string }) {
  const up = value >= 0;
  return (
    <span className={cn("num inline-flex items-center gap-1 text-xs", up ? "text-bull" : "text-bear", className)}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

export function LivePrice({ value, decimals = 2, className }: { value: number; decimals?: number; className?: string }) {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value > prev.current) setDir("up");
    else if (value < prev.current) setDir("down");
    prev.current = value;
    const id = setTimeout(() => setDir(null), 700);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <span
      className={cn(
        "num rounded px-1",
        dir === "up" && "flash-up text-bull",
        dir === "down" && "flash-down text-bear",
        className,
      )}
    >
      {value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("panel hover-lift flex flex-col", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{title}</h3>
          {action}
        </header>
      )}
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

/** Animated sparkline that redraws when data changes. */
export function Sparkline({
  data,
  color = "var(--bull)",
  height = 40,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [
    (i / Math.max(1, data.length - 1)) * 100,
    height - ((v - min) / span) * (height - 4) - 2,
  ]);
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`).join(" ");
  const id = `g${Math.abs((data[0] ?? 0) * 1000).toFixed(0)}${data.length}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d} L100,${height} L0,${height} Z`} fill={`url(#${id})`} />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        className="[stroke-dasharray:400] [stroke-dashoffset:0] animate-[dash_1.4s_ease-out]"
      />
      <style>{`@keyframes dash{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}`}</style>
    </svg>
  );
}

export function Gauge({
  value,
  label,
  size = 132,
  max = 100,
}: {
  value: number;
  label: string;
  size?: number;
  max?: number;
}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const color = pct > 0.6 ? "var(--bull)" : pct > 0.4 ? "var(--chart-4)" : "var(--bear)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl font-bold">{Math.round(value)}</span>
        <span className="text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">{label}</span>
      </div>
    </div>
  );
}
