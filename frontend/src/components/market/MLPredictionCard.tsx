import { useState } from "react";
import { Panel } from "@/components/market/primitives";
import { fmt } from "@/lib/market";
import { usePaperTrading } from "@/lib/paperTrading";
import { Sparkles, TrendingUp, TrendingDown, ShieldAlert, Cpu, ArrowUpRight, CheckCircle2, Info } from "lucide-react";

export type PredictionData = {
  status: string;
  symbol: string;
  current_price: number;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  win_probability: number;
  confidence: number;
  expected_return_5d: number;
  target_price: number;
  bull_target: number;
  stop_loss: number;
  atr_14: number;
  rsi_14: number;
  feature_attributions: Array<{
    factor: string;
    weight: string;
    tone: "bullish" | "bearish" | "neutral";
    desc: string;
  }>;
  projection_cone: Array<{
    day: number;
    label: string;
    expected: number;
    upper: number;
    lower: number;
  }>;
  model_metadata: {
    version: string;
    hit_rate: number;
    sharpe_ratio: number;
    sortino_ratio: number;
  };
};

export default function MLPredictionCard({
  prediction,
  loading = false,
  onRetrain,
}: {
  prediction: PredictionData | null;
  loading?: boolean;
  onRetrain?: () => void;
}) {
  const paper = usePaperTrading();
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (loading) {
    return (
      <Panel title="Surya ML Predictive Intelligence Engine">
        <div className="py-8 text-center text-xs text-muted-foreground animate-pulse space-y-2">
          <Cpu className="size-6 text-primary mx-auto animate-spin" />
          <p className="font-semibold">Computing Multi-Horizon ML Inference & Feature Attributions...</p>
        </div>
      </Panel>
    );
  }

  if (!prediction) return null;

  const isBull = prediction.direction === "BULLISH";
  const isBear = prediction.direction === "BEARISH";
  const dirColor = isBull ? "text-bull" : isBear ? "text-bear" : "text-primary";
  const dirBg = isBull ? "bg-bull/15 border-bull/30" : isBear ? "bg-bear/15 border-bear/30" : "bg-primary/15 border-primary/30";

  const handleExecuteTrade = () => {
    if (isBear) {
      const res = paper.sellStock(prediction.symbol, prediction.current_price, 10);
      setTradeMsg({ text: res.message, ok: res.success });
    } else {
      const res = paper.buyStock(prediction.symbol, prediction.symbol, prediction.current_price, 10);
      setTradeMsg({ text: res.message, ok: res.success });
    }
    setTimeout(() => setTradeMsg(null), 4000);
  };

  return (
    <Panel
      title="Surya ML Predictive Engine (5-Day Horizon Forecast)"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[0.62rem] text-muted-foreground">Model: {prediction.model_metadata.version}</span>
          <span className="rounded bg-primary/20 text-primary px-2 py-0.5 text-[0.6rem] font-bold">
            Sortino: {prediction.model_metadata.sortino_ratio}
          </span>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Main Verdict & Probability Header */}
        <div className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-4 ${dirBg}`}>
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-full grid place-items-center ${isBull ? "bg-bull/20 text-bull" : isBear ? "bg-bear/20 text-bear" : "bg-primary/20 text-primary"}`}>
              {isBull ? <TrendingUp className="size-5" /> : isBear ? <TrendingDown className="size-5" /> : <Sparkles className="size-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-base font-extrabold tracking-wide uppercase ${dirColor}`}>
                  {prediction.direction} SETUP
                </span>
                <span className="text-[0.68rem] font-bold px-2 py-0.5 rounded bg-background/80">
                  {prediction.win_probability}% Probability
                </span>
              </div>
              <p className="text-[0.68rem] text-muted-foreground mt-0.5">
                Expected 5-Day Move: <strong className={dirColor}>{prediction.expected_return_5d >= 0 ? "+" : ""}{prediction.expected_return_5d}%</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">Target Price</span>
            <p className="num text-xl font-bold text-foreground">₹{fmt(prediction.target_price, 2)}</p>
          </div>
        </div>

        {/* Forecast Target Corridor Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 rounded bg-secondary/40 border border-border/50">
            <span className="text-[0.6rem] font-bold uppercase text-bear">Safe Stop-Loss</span>
            <p className="num text-sm font-bold text-bear mt-0.5">₹{fmt(prediction.stop_loss, 2)}</p>
            <span className="text-[0.58rem] text-muted-foreground">Risk Floor (-1.1 ATR)</span>
          </div>

          <div className="p-2.5 rounded bg-secondary/40 border border-border/50">
            <span className="text-[0.6rem] font-bold uppercase text-primary">Expected Target (Base)</span>
            <p className="num text-sm font-bold text-primary mt-0.5">₹{fmt(prediction.target_price, 2)}</p>
            <span className="text-[0.58rem] text-muted-foreground">Median Statistical Path</span>
          </div>

          <div className="p-2.5 rounded bg-secondary/40 border border-border/50">
            <span className="text-[0.6rem] font-bold uppercase text-bull">Bull Target (Upper)</span>
            <p className="num text-sm font-bold text-bull mt-0.5">₹{fmt(prediction.bull_target, 2)}</p>
            <span className="text-[0.58rem] text-muted-foreground">+1.4 ATR Momentum Band</span>
          </div>
        </div>

        {/* Explainable AI: Feature Attributions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" /> Key Driving Factors (Model Explainability)
            </span>
            <span className="text-[0.6rem] text-muted-foreground">Calibrated Feature Weights</span>
          </div>

          <div className="space-y-1.5">
            {prediction.feature_attributions.map((attr, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      attr.tone === "bullish" ? "bg-bull" : attr.tone === "bearish" ? "bg-bear" : "bg-muted-foreground"
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-foreground mr-2">{attr.factor}</span>
                    <span className="text-[0.68rem] text-muted-foreground hidden sm:inline">{attr.desc}</span>
                  </div>
                </div>
                <span
                  className={`font-bold font-mono text-[0.72rem] shrink-0 ml-2 ${
                    attr.tone === "bullish" ? "text-bull" : attr.tone === "bearish" ? "text-bear" : "text-muted-foreground"
                  }`}
                >
                  {attr.weight}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 1-Click Action Button */}
        <div className="pt-1">
          <button
            onClick={handleExecuteTrade}
            className={`w-full py-2.5 rounded font-bold text-xs uppercase flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.99] text-white shadow-sm ${
              isBear ? "bg-bear" : "bg-bull"
            }`}
          >
            <ArrowUpRight className="size-4" />
            Execute ML {isBear ? "SELL / SHORT" : "BUY"} Setup in Paper Wallet (10 Shares @ ₹{fmt(prediction.current_price, 2)})
          </button>

          {tradeMsg && (
            <div
              className={`mt-2 p-2 rounded text-xs font-semibold text-center ${
                tradeMsg.ok ? "bg-bull/15 text-bull border border-bull/30" : "bg-bear/15 text-bear border border-bear/30"
              }`}
            >
              {tradeMsg.text}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
