import { useEffect, useRef, useState } from "react";
import { BASE_QUOTES, SECTORS, SECTOR_COLOR } from "@/lib/market";

const SECTOR_PCT: Record<string, number> = {
  Technology: 0.92,
  Financials: 0.28,
  Healthcare: 0.22,
  "Consumer Cyclical": 1.11,
  Communication: 0.45,
  Industrials: 0.61,
  "Consumer Defensive": 0.35,
  Energy: -0.64,
  Utilities: -0.12,
  "Real Estate": -0.33,
  Materials: -0.47,
};

type Star = { x: number; y: number; z: number; r: number; sector: string; symbol?: string | undefined };

/** 3D rotating star-cluster map of the market. Drag to rotate, scroll to zoom. */
export default function GalaxyCanvas({
  activeSector,
  onPick,
}: {
  activeSector: string;
  onPick: (symbol: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const state = useRef({ rotX: -0.22, rotY: 0, zoom: 1, drag: false, lx: 0, ly: 0, auto: true });
  const [, force] = useState(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // build clusters
    let seed = 9;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const stars: Star[] = [];
    SECTORS.forEach((s, i) => {
      const a = (i / SECTORS.length) * Math.PI * 2;
      const ring = 0.55 + (i % 3) * 0.16;
      const cx = Math.cos(a) * ring;
      const cy = Math.sin(a) * ring * 0.55;
      const cz = Math.sin(a * 1.7) * 0.35;
      const members = BASE_QUOTES.filter((q) => q.sector === s);
      for (let k = 0; k < 260; k++) {
        const rad = Math.pow(rnd(), 0.6) * 0.2;
        const th = rnd() * Math.PI * 2;
        const ph = Math.acos(2 * rnd() - 1);
        stars.push({
          x: cx + rad * Math.sin(ph) * Math.cos(th),
          y: cy + rad * Math.sin(ph) * Math.sin(th),
          z: cz + rad * Math.cos(ph),
          r: 0.7 + rnd() * 2.1,
          sector: s,
          symbol: members[k]?.symbol,
        });
      }
      stars.push({ x: cx, y: cy, z: cz, r: 6, sector: s, symbol: members[0]?.symbol });
    });
    const bg = Array.from({ length: 320 }, () => ({
      x: rnd() * 2 - 1,
      y: rnd() * 2 - 1,
      r: rnd() * 0.9,
    }));

    let raf = 0;
    const draw = () => {
      const st = state.current;
      if (st.auto && !st.drag) st.rotY += 0.0012;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#04060c";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const S = Math.min(w, h) * 0.62 * st.zoom;

      bg.forEach((b) => {
        ctx.beginPath();
        ctx.arc(cx + b.x * w * 0.5, cy + b.y * h * 0.5, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();
      });

      const cosY = Math.cos(st.rotY);
      const sinY = Math.sin(st.rotY);
      const cosX = Math.cos(st.rotX);
      const sinX = Math.sin(st.rotX);

      const proj = stars.map((p) => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const persp = 1 / (1.7 - z2 * 0.5);
        return { p, px: cx + x1 * S * persp, py: cy + y1 * S * persp, depth: z2, persp };
      });
      proj.sort((a, b) => a.depth - b.depth);

      for (const q of proj) {
        const dim = activeSector !== "All Sectors" && q.p.sector !== activeSector;
        const color = SECTOR_COLOR[q.p.sector] ?? "#8ab4ff";
        const alpha = (dim ? 0.08 : 0.35 + (q.depth + 1) * 0.32) * (q.p.r > 3 ? 1 : 0.9);
        const size = q.p.r * q.persp * st.zoom * 1.25;
        if (q.p.r > 3) {
          const g = ctx.createRadialGradient(q.px, q.py, 0, q.px, q.py, size * 9);
          g.addColorStop(0, color);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = dim ? 0.08 : 0.55;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.px, q.py, size * 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(q.px, q.py, Math.max(0.4, size), 0, Math.PI * 2);
        ctx.fill();
      }
      // sector labels at cluster cores
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      for (const q of proj) {
        if (q.p.r < 5) continue;
        const dim = activeSector !== "All Sectors" && q.p.sector !== activeSector;
        const perf = SECTOR_PCT[q.p.sector] ?? 0;
        ctx.globalAlpha = dim ? 0.2 : 0.95;
        ctx.font = "600 11px 'Chakra Petch', sans-serif";
        ctx.fillStyle = "rgba(235,242,255,0.92)";
        ctx.fillText(q.p.sector.toUpperCase(), q.px, q.py - 34);
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = perf >= 0 ? "#4ade80" : "#f87171";
        ctx.fillText(`${perf >= 0 ? "+" : ""}${perf.toFixed(2)}%`, q.px, q.py - 20);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const down = (e: PointerEvent) => {
      state.current.drag = true;
      state.current.lx = e.clientX;
      state.current.ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      const st = state.current;
      if (!st.drag) return;
      st.rotY += (e.clientX - st.lx) * 0.005;
      st.rotX += (e.clientY - st.ly) * 0.004;
      st.rotX = Math.max(-1.1, Math.min(1.1, st.rotX));
      st.lx = e.clientX;
      st.ly = e.clientY;
    };
    const up = () => (state.current.drag = false);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      state.current.zoom = Math.max(0.6, Math.min(2.4, state.current.zoom - e.deltaY * 0.001));
      force((n) => n + 1);
    };
    const click = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const st = state.current;
      const S = Math.min(w, h) * 0.62 * st.zoom;
      let best: { d: number; sym?: string } = { d: 1e9 };
      const cosY = Math.cos(st.rotY);
      const sinY = Math.sin(st.rotY);
      const cosX = Math.cos(st.rotX);
      const sinX = Math.sin(st.rotX);
      for (const p of stars) {
        if (!p.symbol) continue;
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const persp = 1 / (1.7 - z2 * 0.5);
        const px = w / 2 + x1 * S * persp;
        const py = h / 2 + y1 * S * persp;
        const d = Math.hypot(px - mx, py - my);
        if (d < best.d) best = { d, sym: p.symbol };
      }
      onPick(best.d < 26 ? (best.sym ?? null) : null);
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("click", click);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("click", click);
    };
  }, [activeSector, onPick]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing" />;
}
