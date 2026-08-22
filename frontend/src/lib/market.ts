import { useEffect, useRef, useState } from "react";

export type Quote = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  sector: string;
  marketCap: string;
  volume: string;
};

export type Sector = { name: string; pct: number; cap: string };

const seedList: Omit<Quote, "change" | "changePct">[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd.", exchange: "NSE", price: 2956.4, sector: "Energy", marketCap: "19.32T", volume: "8.72M" },
  { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NSE", price: 4217.65, sector: "Technology", marketCap: "15.28T", volume: "2.10M" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", exchange: "NSE", price: 1734.5, sector: "Financials", marketCap: "13.11T", volume: "11.4M" },
  { symbol: "INFY", name: "Infosys Ltd.", exchange: "NSE", price: 1508.2, sector: "Technology", marketCap: "6.24T", volume: "5.81M" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", exchange: "NSE", price: 1215.3, sector: "Financials", marketCap: "8.52T", volume: "9.03M" },
  { symbol: "LT", name: "Larsen & Toubro Ltd.", exchange: "NSE", price: 3658.1, sector: "Industrials", marketCap: "5.02T", volume: "1.94M" },
  { symbol: "BEL", name: "Bharat Electronics Ltd.", exchange: "NSE", price: 312.45, sector: "Industrials", marketCap: "2.28T", volume: "22.7M" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd.", exchange: "NSE", price: 2893.6, sector: "Consumer Cyclical", marketCap: "3.60T", volume: "3.42M" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", exchange: "NSE", price: 2487.95, sector: "Consumer Defensive", marketCap: "5.84T", volume: "1.22M" },
  { symbol: "ASHOKLEY", name: "Ashok Leyland Ltd.", exchange: "NSE", price: 245.7, sector: "Consumer Cyclical", marketCap: "0.72T", volume: "31.5M" },
  { symbol: "TITAN", name: "Titan Company Ltd.", exchange: "NSE", price: 3254.5, sector: "Consumer Cyclical", marketCap: "2.89T", volume: "1.11M" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Ind.", exchange: "NSE", price: 1642.35, sector: "Healthcare", marketCap: "3.94T", volume: "2.66M" },
  { symbol: "NTPC", name: "NTPC Ltd.", exchange: "NSE", price: 372.8, sector: "Utilities", marketCap: "3.61T", volume: "14.2M" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd.", exchange: "NSE", price: 1432.15, sector: "Communication", marketCap: "8.31T", volume: "6.05M" },
  { symbol: "DLF", name: "DLF Ltd.", exchange: "NSE", price: 812.4, sector: "Real Estate", marketCap: "2.01T", volume: "4.31M" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd.", exchange: "NSE", price: 168.9, sector: "Materials", marketCap: "2.11T", volume: "48.9M" },
];

export const SECTORS = [
  "Precious Metals",
  "Base Metals",
  "Energy",
  "Real Estate",
  "Technology",
  "Financials",
  "Healthcare",
  "Consumer Cyclical",
  "Communication",
  "Industrials",
  "Utilities",
  "Materials",
] as const;

export const SECTOR_COLOR: Record<string, string> = {
  "Precious Metals": "#f59e0b",
  "Base Metals": "#d97706",
  "Energy": "#ef4444",
  "Real Estate": "#ec4899",
  "Technology": "#06b6d4",
  "Financials": "#3b82f6",
  "Healthcare": "#10b981",
  "Consumer Cyclical": "#22c55e",
  "Communication": "#8b5cf6",
  "Industrials": "#38bdf8",
  "Utilities": "#eab308",
  "Materials": "#f97316",
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const r0 = rng(42);
export const BASE_QUOTES: Quote[] = seedList.map((q) => {
  const pct = (r0() - 0.42) * 3;
  return { ...q, changePct: +pct.toFixed(2), change: +((q.price * pct) / 100).toFixed(2) };
});

export const INDICES = [
  { symbol: "NIFTY 50", price: 24834.85, changePct: 0.68 },
  { symbol: "SENSEX", price: 81330.56, changePct: 0.62 },
  { symbol: "BANK NIFTY", price: 55624.45, changePct: 0.58 },
  { symbol: "FIN NIFTY", price: 26073.1, changePct: 0.59 },
  { symbol: "MIDCAP 100", price: 57751.3, changePct: 0.6 },
  { symbol: "INDIA VIX", price: 12.85, changePct: -2.65 },
  { symbol: "GOLD (MCX)", price: 72015, changePct: 0.39 },
  { symbol: "SILVER (MCX)", price: 86245, changePct: 0.71 },
  { symbol: "USD/INR", price: 83.23, changePct: -0.14 },
  { symbol: "BTC/INR", price: 5728451, changePct: -0.32 },
  { symbol: "ETH/INR", price: 312450, changePct: -0.4 },
  { symbol: "S&P 500", price: 5321.41, changePct: 0.29 },
  { symbol: "NASDAQ", price: 16832.62, changePct: 0.36 },
  { symbol: "DOW 30", price: 39483.98, changePct: 0.25 },
];

export const SECTOR_PERF: Sector[] = [
  { name: "Financial Services", pct: 0.92, cap: "₹29.68T" },
  { name: "IT Services", pct: 1.12, cap: "₹17.63T" },
  { name: "Oil & Gas", pct: 0.48, cap: "₹9.45T" },
  { name: "Automobile", pct: -0.37, cap: "₹6.05T" },
  { name: "Consumer Goods", pct: 0.35, cap: "₹8.91T" },
  { name: "Pharma", pct: 0.72, cap: "₹6.23T" },
  { name: "Metals", pct: -0.28, cap: "₹4.71T" },
  { name: "Power", pct: 0.26, cap: "₹4.10T" },
  { name: "Cement", pct: -0.41, cap: "₹2.94T" },
  { name: "Telecom", pct: 0.15, cap: "₹2.79T" },
  { name: "Consumer Services", pct: -0.12, cap: "₹2.68T" },
  { name: "Chemicals", pct: -0.08, cap: "₹2.05T" },
  { name: "Realty", pct: -0.56, cap: "₹1.88T" },
  { name: "Others", pct: 0.09, cap: "₹3.12T" },
];

export const NEWS = [
  { title: "RBI keeps rates unchanged, maintains 'withdrawal of accommodation' stance", src: "Economic Times", ago: "12m ago", tone: "neutral" },
  { title: "IT stocks lead market rally; Nifty reclaims 24,800 mark", src: "Moneycontrol", ago: "28m ago", tone: "positive" },
  { title: "Global cues mixed as Fed minutes show caution on rate cuts", src: "Bloomberg", ago: "1h ago", tone: "neutral" },
  { title: "FII flows turn positive: +₹1,245 Cr net buying in cash segment", src: "NSE Data", ago: "2h ago", tone: "positive" },
  { title: "Crude softens below $79; OMC margins seen improving", src: "Reuters", ago: "3h ago", tone: "positive" },
  { title: "Realty index slips on weak pre-sales commentary", src: "Mint", ago: "4h ago", tone: "negative" },
];

export const AI_SIGNALS = [
  { symbol: "TCS", action: "BUY", note: "Momentum breakout detected", target: 4350, confidence: 78 },
  { symbol: "INFY", action: "BUY", note: "Strong support rebound", target: 1560, confidence: 72 },
  { symbol: "RELIANCE", action: "HOLD", note: "Consolidation phase", target: 3000, confidence: 61 },
  { symbol: "HDFCBANK", action: "BUY", note: "Volume expansion above 20 EMA", target: 1810, confidence: 69 },
  { symbol: "TATASTEEL", action: "SELL", note: "Bearish divergence on RSI", target: 158, confidence: 64 },
];

/** Deterministic OHLC candle series for a symbol. */
export function candles(symbol: string, count = 120, base = 2500) {
  const rand = rng(symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 7) * 97);
  let price = base * 0.82;
  const out: { i: number; o: number; h: number; l: number; c: number; v: number }[] = [];
  for (let i = 0; i < count; i++) {
    const drift = (base * 0.0032) * (rand() - 0.4);
    const o = price;
    const c = Math.max(base * 0.5, o + drift * 6 + (rand() - 0.5) * base * 0.012);
    const h = Math.max(o, c) + rand() * base * 0.006;
    const l = Math.min(o, c) - rand() * base * 0.006;
    out.push({ i, o, h, l, c, v: Math.round(4_000_000 + rand() * 12_000_000) });
    price = c;
  }
  const last = out[out.length - 1]!.c;
  const k = base / last;
  return out.map((d) => ({ ...d, o: d.o * k, h: d.h * k, l: d.l * k, c: d.c * k }));
}

export function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  return values.map((v, i) => (i === 0 ? v : (prev = v * k + prev * (1 - k))));
}

/** Simulated live tick: nudges quotes on an interval. */
export function useLiveQuotes(initial: Quote[] = BASE_QUOTES, ms = 1400) {
  const [quotes, setQuotes] = useState(initial);
  const ref = useRef(initial);
  useEffect(() => {
    const id = setInterval(() => {
      ref.current = ref.current.map((q) => {
        const delta = (Math.random() - 0.5) * q.price * 0.0016;
        const price = +(q.price + delta).toFixed(2);
        const base = q.price - q.change;
        const change = +(price - base).toFixed(2);
        return { ...q, price, change, changePct: +((change / base) * 100).toFixed(2) };
      });
      setQuotes(ref.current);
    }, ms);
    return () => clearInterval(id);
  }, [ms]);
  return quotes;
}

export function useClock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-IN", { hour12: false, timeZone: "Asia/Kolkata" });
    setT(fmt());
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export function fmt(n: number, d = 2) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function findQuote(symbol: string) {
  return BASE_QUOTES.find((q) => q.symbol.toLowerCase() === symbol.toLowerCase());
}
