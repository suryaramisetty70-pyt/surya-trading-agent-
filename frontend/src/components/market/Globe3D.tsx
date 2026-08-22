import { useEffect, useRef } from "react";

/**
 * Canvas-rendered rotating 3D point-cloud globe with orbital rings.
 * Pure math projection — no WebGL dependency, runs everywhere.
 */
export default function Globe3D({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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

    // fibonacci sphere points
    const N = 320;
    const pts: { x: number; y: number; z: number; hot: boolean }[] = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      pts.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        hot: i % 19 === 0,
      });
    }
    const rings = [0.18, -0.35, 0.62];

    let t = 0;
    const draw = () => {
      t += 0.0035;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.34;
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const tilt = 0.35;

      for (const p of pts) {
        const x1 = p.x * cosT - p.z * sinT;
        const z1 = p.x * sinT + p.z * cosT;
        const y1 = p.y * Math.cos(tilt) - z1 * Math.sin(tilt);
        const z2 = p.y * Math.sin(tilt) + z1 * Math.cos(tilt);
        const scale = 0.65 + (z2 + 1) * 0.32;
        const px = cx + x1 * R * scale;
        const py = cy + y1 * R * scale;
        const alpha = 0.12 + ((z2 + 1) / 2) * 0.85;
        const size = p.hot ? 1.9 * scale : 1.05 * scale;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = p.hot
          ? `rgba(125,211,252,${alpha})`
          : `rgba(56,189,248,${alpha * 0.75})`;
        ctx.fill();
      }

      // orbital rings
      rings.forEach((incl, idx) => {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.03) {
          const rr = R * (1.18 + idx * 0.12);
          const x = Math.cos(a + t * (1 + idx * 0.25)) * rr;
          const z = Math.sin(a + t * (1 + idx * 0.25)) * rr;
          const y = z * Math.sin(incl);
          const zz = z * Math.cos(incl);
          const sc = 0.75 + (zz / rr + 1) * 0.18;
          const px = cx + x * sc;
          const py = cy + (y * Math.cos(tilt) + zz * Math.sin(tilt) * 0.25) * sc * 0.55;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(96,165,250,${0.22 - idx * 0.03})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
