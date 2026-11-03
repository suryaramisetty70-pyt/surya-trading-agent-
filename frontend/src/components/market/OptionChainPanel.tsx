import { useState, useEffect } from "react";
import { Panel } from "@/components/market/primitives";
import { fmt } from "@/lib/market";
import { usePaperTrading } from "@/lib/paperTrading";
import { Layers, ArrowUpRight, ArrowDownRight, RefreshCw, Info } from "lucide-react";

export type OptionStrikeRow = {
  strike: number;
  is_atm: boolean;
  iv_pct: number;
  call: {
    ltp: number;
    oi: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  put: {
    ltp: number;
    oi: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
};

export type OptionChainData = {
  status: string;
  symbol: string;
  spot_price: number;
  atm_strike: number;
  max_pain_strike: number;
  days_to_expiry: number;
  pcr: number;
  sentiment: string;
  total_call_oi: number;
  total_put_oi: number;
  avg_iv: number;
  chain: OptionStrikeRow[];
};

export default function OptionChainPanel({ ticker = "NIFTY" }: { ticker?: string }) {
  const [data, setData] = useState<OptionChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTicker, setActiveTicker] = useState(ticker);
  const paper = usePaperTrading();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchChain = (sym: string) => {
    setLoading(true);
    fetch(`/api/options-chain?ticker=${encodeURIComponent(sym)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "success" && res.data) {
          setData(res.data);
        }
      })
      .catch((e) => console.error("Error fetching options chain:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChain(activeTicker);
  }, [activeTicker]);

  const handleBuyOption = (type: "CE" | "PE", strike: number, premium: number) => {
    const optSym = `${activeTicker}_${strike}_${type}`;
    const res = paper.buyStock(optSym, `${activeTicker} ${strike} ${type}`, premium, 50); // 1 lot = 50 qty
    setMsg({ text: res.message, ok: res.success });
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Header controls & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase">Underlying:</span>
          {["NIFTY", "BANKNIFTY", "TCS", "RELIANCE", "HDFCBANK"].map((s) => (
            <button
              key={s}
              onClick={() => setActiveTicker(s)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                activeTicker === s ? "bg-primary text-primary-foreground font-bold" : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchChain(activeTicker)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs text-muted-foreground hover:text-foreground font-semibold"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Chain
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded bg-secondary/40 border border-border/60">
            <p className="text-[0.62rem] uppercase text-muted-foreground">Spot Price</p>
            <p className="num text-lg font-bold text-foreground">₹{fmt(data.spot_price, 2)}</p>
          </div>

          <div className="p-3 rounded bg-secondary/40 border border-border/60">
            <p className="text-[0.62rem] uppercase text-muted-foreground">Max Pain Strike</p>
            <p className="num text-lg font-bold text-primary">₹{fmt(data.max_pain_strike, 0)}</p>
            <p className="text-[0.58rem] text-muted-foreground">Expiry Pinning Gravity</p>
          </div>

          <div className="p-3 rounded bg-secondary/40 border border-border/60">
            <p className="text-[0.62rem] uppercase text-muted-foreground">Put-Call Ratio (PCR)</p>
            <p className={`num text-lg font-bold ${data.pcr >= 1.15 ? "text-bull" : data.pcr <= 0.85 ? "text-bear" : "text-primary"}`}>
              {data.pcr}
            </p>
            <p className="text-[0.58rem] text-muted-foreground">{data.sentiment}</p>
          </div>

          <div className="p-3 rounded bg-secondary/40 border border-border/60">
            <p className="text-[0.62rem] uppercase text-muted-foreground">Near-Month Implied Vol (IV)</p>
            <p className="num text-lg font-bold text-chart-4">{data.avg_iv}%</p>
            <p className="text-[0.58rem] text-muted-foreground">{data.days_to_expiry} Days to Expiry</p>
          </div>
        </div>
      )}

      {msg && (
        <div
          className={`p-2.5 rounded text-xs font-semibold text-center ${
            msg.ok ? "bg-bull/15 text-bull border border-bull/30" : "bg-bear/15 text-bear border border-bear/30"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Option Chain Table */}
      <Panel title={`Live Option Chain & Black-Scholes Greeks — ${activeTicker}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-[0.65rem] tracking-wider uppercase text-muted-foreground">
                <th colSpan={4} className="py-1.5 border-r border-border text-bull font-bold">CALL OPTIONS (CE)</th>
                <th className="py-1.5 font-bold text-foreground">STRIKE</th>
                <th colSpan={4} className="py-1.5 border-l border-border text-bear font-bold">PUT OPTIONS (PE)</th>
              </tr>
              <tr className="border-b border-border text-[0.6rem] text-muted-foreground uppercase">
                <th className="py-1.5">OI</th>
                <th className="py-1.5">IV%</th>
                <th className="py-1.5">Delta</th>
                <th className="py-1.5 border-r border-border font-bold text-foreground">LTP (₹)</th>
                <th className="py-1.5 font-bold text-primary bg-primary/10">Strike</th>
                <th className="py-1.5 border-l border-border font-bold text-foreground">LTP (₹)</th>
                <th className="py-1.5">Delta</th>
                <th className="py-1.5">IV%</th>
                <th className="py-1.5">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-[0.72rem]">
              {data?.chain.map((row) => (
                <tr
                  key={row.strike}
                  className={`hover:bg-secondary/40 transition ${
                    row.is_atm ? "bg-primary/10 font-bold" : ""
                  }`}
                >
                  {/* Call columns */}
                  <td className="py-2 text-muted-foreground">{row.call.oi.toLocaleString("en-IN")}</td>
                  <td className="py-2 text-muted-foreground">{row.iv_pct}%</td>
                  <td className="py-2 text-bull">+{row.call.delta}</td>
                  <td className="py-2 border-r border-border font-bold">
                    <button
                      onClick={() => handleBuyOption("CE", row.strike, row.call.ltp)}
                      className="px-2 py-0.5 rounded bg-bull/15 hover:bg-bull hover:text-white text-bull transition text-[0.68rem] font-bold"
                      title="Buy Call (1 Lot = 50 Qty)"
                    >
                      ₹{fmt(row.call.ltp, 2)}
                    </button>
                  </td>

                  {/* Strike column */}
                  <td className={`py-2 px-3 font-bold ${row.is_atm ? "text-primary bg-primary/20" : "text-foreground"}`}>
                    {row.strike}
                    {row.is_atm && <span className="ml-1 text-[0.55rem] text-primary uppercase font-bold">(ATM)</span>}
                  </td>

                  {/* Put columns */}
                  <td className="py-2 border-l border-border font-bold">
                    <button
                      onClick={() => handleBuyOption("PE", row.strike, row.put.ltp)}
                      className="px-2 py-0.5 rounded bg-bear/15 hover:bg-bear hover:text-white text-bear transition text-[0.68rem] font-bold"
                      title="Buy Put (1 Lot = 50 Qty)"
                    >
                      ₹{fmt(row.put.ltp, 2)}
                    </button>
                  </td>
                  <td className="py-2 text-bear">{row.put.delta}</td>
                  <td className="py-2 text-muted-foreground">{row.iv_pct}%</td>
                  <td className="py-2 text-muted-foreground">{row.put.oi.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
