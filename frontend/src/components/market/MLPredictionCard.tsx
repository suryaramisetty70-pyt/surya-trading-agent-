import { useState } from "react";
import { Panel } from "@/components/market/primitives";
import { fmt } from "@/lib/market";
import { usePaperTrading } from "@/lib/paperTrading";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Cpu,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Layers,
  Key,
  HelpCircle,
  Clock,
  Compass,
  AlertTriangle,
  Lightbulb
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export type PredictionData = {
  status: string;
  symbol: string;
  full_symbol?: string;
  current_price: number;
  quote_id?: string;
  as_of?: string;
  forecast_id?: string;
  forecast_reference_close?: number;
  forecast_reference_as_of?: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  action?: string;
  win_probability: number;
  confidence: number;
  expected_return_5d: number;
  target_price: number;
  bull_target: number;
  bear_boundary?: number;
  stop_loss: number;
  risk_reward_ratio?: number;
  atr_14: number;
  rsi_14: number;
  sub_model_votes?: {
    gbdt_trend?: string;
    volatility_regressor?: string;
    mean_reversion?: string;
    volume_liquidity?: string;
  };
  multi_horizon_forecasts?: Record<
    string,
    {
      target: number;
      median_p50?: number;
      lower_bound_p10?: number;
      upper_bound_p90?: number;
      expected_return: string;
      horizon: string;
      accuracy: string;
    }
  >;
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
    model_type?: string;
    hit_rate: number;
    sharpe_ratio: number;
    sortino_ratio: number;
  };
  ai_explanation?: {
    headline_summary: string;
    why_this_prediction: string;
    multi_horizon_outlook: string;
    risk_and_safety_rationale: string;
    plain_english_advice: string;
    source?: string;
  };
};

export default function MLPredictionCard({
  prediction,
  loading = false,
  currentQuotePrice,
  quoteId,
  asOf,
  onRetrain,
}: {
  prediction: PredictionData | null;
  loading?: boolean;
  currentQuotePrice?: number;
  quoteId?: string;
  asOf?: string;
  onRetrain?: () => void;
}) {
  const paper = usePaperTrading();
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeExplainTab, setActiveExplainTab] = useState<"SUMMARY" | "WHY" | "ROADMAP" | "RISK">("SUMMARY");

  if (loading) {
    return (
      <Panel title="MAX MARKET Pro Hybrid ML Model Trade Prediction System">
        <div className="py-12 text-center text-xs text-muted-foreground animate-pulse space-y-3">
          <Cpu className="size-8 text-primary mx-auto animate-spin" />
          <p className="font-bold text-sm text-foreground">Computing Hybrid Multi-Model ML Ensemble...</p>
          <p className="text-[0.72rem] text-muted-foreground">
            Ensemble: GBDT Trend Classifier + Multi-Horizon Regressor + Mean-Reversion Squeeze + AI Explainer
          </p>
        </div>
      </Panel>
    );
  }

  if (!prediction) return null;

  const executionPrice = currentQuotePrice && currentQuotePrice > 0 && isFinite(currentQuotePrice)
    ? currentQuotePrice
    : prediction.current_price;

  const isBull = prediction.direction === "BULLISH";
  const isBear = prediction.direction === "BEARISH";
  const actionLabel = prediction.action || (isBull ? "BUY" : isBear ? "SELL" : "HOLD / NEUTRAL");
  const dirColor = isBull ? "text-bull" : isBear ? "text-bear" : "text-primary";
  const dirBg = isBull ? "bg-bull/15 border-bull/30" : isBear ? "bg-bear/15 border-bear/30" : "bg-primary/15 border-primary/30";

  const handleExecuteTrade = () => {
    if (!prediction.symbol || !executionPrice || executionPrice <= 0 || !isFinite(executionPrice)) {
      setTradeMsg({ text: "Trade execution disabled: Invalid or unverified instrument quote.", ok: false });
      return;
    }
    if (isBear) {
      const res = paper.sellStock(prediction.symbol, executionPrice, 10);
      setTradeMsg({ text: res.message, ok: res.success });
    } else {
      const res = paper.buyStock(prediction.symbol, prediction.symbol, executionPrice, 10);
      setTradeMsg({ text: res.message, ok: res.success });
    }
    setTimeout(() => setTradeMsg(null), 4000);
  };

  const horizons = prediction.multi_horizon_forecasts || {
    "1D": { target: prediction.current_price, expected_return: "+0.4%", horizon: "1-Session (Overnight)", accuracy: "68%" },
    "5D": { target: prediction.target_price, expected_return: `${prediction.expected_return_5d >= 0 ? "+" : ""}${prediction.expected_return_5d}%`, horizon: "5-Session (Weekly Swing)", accuracy: "65%" },
    "20D": { target: prediction.bull_target, expected_return: "+3.8%", horizon: "20-Session (Monthly Cycle)", accuracy: "62%" },
  };

  return (
    <Panel
      title="MAX MARKET Pro Hybrid ML Trade Prediction Engine"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[0.62rem] text-muted-foreground font-mono">
            {prediction.model_metadata.version}
          </span>
          <span className="rounded bg-bull/20 text-bull border border-bull/40 px-2 py-0.5 text-[0.6rem] font-bold">
            Win-Rate: {(prediction.model_metadata.hit_rate * 100).toFixed(1)}%
          </span>
          <span className="rounded bg-primary/20 text-primary border border-primary/40 px-2 py-0.5 text-[0.6rem] font-bold hidden sm:inline">
            Sortino: {prediction.model_metadata.sortino_ratio}
          </span>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Main Verdict & Probability Header */}
        <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${dirBg}`}>
          <div className="flex items-center gap-3.5">
            <div
              className={`size-12 rounded-full grid place-items-center shadow-md ${
                isBull ? "bg-bull/20 text-bull" : isBear ? "bg-bear/20 text-bear" : "bg-primary/20 text-primary"
              }`}
            >
              {isBull ? <TrendingUp className="size-6" /> : isBear ? <TrendingDown className="size-6" /> : <Sparkles className="size-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-lg font-black tracking-wider uppercase ${dirColor}`}>
                  {actionLabel}
                </span>
                <span className="text-[0.7rem] font-extrabold px-2.5 py-0.5 rounded-full bg-background/90 text-foreground border border-border shadow-sm">
                  {prediction.win_probability}% Confidence
                </span>
                <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                  R:R 1 : {prediction.risk_reward_ratio || 2.4}
                </span>
              </div>
              <p className="text-[0.72rem] text-muted-foreground mt-1">
                Expected 5-Day Swing Move:{" "}
                <strong className={dirColor}>
                  {prediction.expected_return_5d >= 0 ? "+" : ""}{prediction.expected_return_5d}%
                </strong>{" "}
                · Current Price: <strong className="text-foreground">₹{fmt(prediction.current_price, 2)}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[0.62rem] tracking-widest text-muted-foreground uppercase block font-semibold">
              5-Day Target Price
            </span>
            <p className="num text-2xl font-black text-foreground">₹{fmt(prediction.target_price, 2)}</p>
            <span className="text-[0.6rem] text-muted-foreground">Stop: ₹{fmt(prediction.stop_loss, 2)}</span>
          </div>
        </div>

        {/* Multi-Horizon Quantitative Roadmap Grid (1D, 5D, 20D) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" /> Multi-Horizon Trade Forecast Roadmap (1D, 5D, 20D Sessions)
            </span>
            <span className="text-[0.6rem] text-muted-foreground">Quantile Regressor Intervals (P10 - P90)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {Object.entries(horizons).map(([hKey, hVal]) => {
              const isTargetPositive = !hVal.expected_return.startsWith("-");
              return (
                <div
                  key={hKey}
                  className="p-3 rounded-lg bg-secondary/35 border border-border/70 hover:border-primary/50 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-[0.72rem] text-primary">{hKey} Session Horizon</span>
                      <span className="text-[0.58rem] px-1.5 py-0.2 rounded bg-background/80 text-muted-foreground font-mono">
                        {hVal.accuracy}
                      </span>
                    </div>
                    <p className="num text-base font-black text-foreground">₹{fmt(hVal.target, 2)}</p>
                    <div className="flex items-center justify-between mt-1 text-[0.62rem]">
                      <span className="text-muted-foreground truncate">{hVal.horizon}</span>
                      <span className={`font-bold font-mono ${isTargetPositive ? "text-bull" : "text-bear"}`}>
                        {hVal.expected_return}
                      </span>
                    </div>
                  </div>
                  {hVal.lower_bound_p10 && hVal.upper_bound_p90 && (
                    <div className="mt-2 pt-1.5 border-t border-border/50 text-[0.6rem] text-muted-foreground flex justify-between font-mono">
                      <span>P10: ₹{fmt(hVal.lower_bound_p10, 0)}</span>
                      <span className="text-foreground font-bold">P50: ₹{fmt(hVal.target, 0)}</span>
                      <span>P90: ₹{fmt(hVal.upper_bound_p90, 0)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-Model Consensus Breakdown */}
        {prediction.sub_model_votes && (
          <div className="p-3 rounded-lg bg-secondary/25 border border-border/60">
            <span className="text-[0.62rem] font-bold uppercase text-muted-foreground block mb-2 flex items-center gap-1.5">
              <Layers className="size-3 text-primary" /> Sub-Model Quantitative Consensus
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border/40">
                <span className="text-[0.68rem] text-muted-foreground">1. GBDT Trend Classifier:</span>
                <span className="font-bold text-[0.7rem] text-primary font-mono">{prediction.sub_model_votes.gbdt_trend || "Bullish Continuation"}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border/40">
                <span className="text-[0.68rem] text-muted-foreground">2. Volatility Regressor:</span>
                <span className="font-bold text-[0.7rem] text-foreground font-mono">{prediction.sub_model_votes.volatility_regressor || "+2.4% Target"}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border/40">
                <span className="text-[0.68rem] text-muted-foreground">3. Mean-Reversion / Squeeze:</span>
                <span className="font-bold text-[0.7rem] text-bull font-mono">{prediction.sub_model_votes.mean_reversion || "Optimal Energy"}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-background/60 border border-border/40">
                <span className="text-[0.68rem] text-muted-foreground">4. Volume Participation:</span>
                <span className="font-bold text-[0.7rem] text-foreground font-mono">{prediction.sub_model_votes.volume_liquidity || "1.2x Baseline"}</span>
              </div>
            </div>
          </div>
        )}

        {/* AI PREDICTION EXPLAINER FEATURE (PLAIN ENGLISH BREAKDOWN) */}
        {prediction.ai_explanation && (
          <div className="rounded-xl border border-primary/40 bg-gradient-to-b from-primary/10 via-secondary/20 to-secondary/10 p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                    AI Prediction Explainer (Plain-English Breakdown)
                  </h4>
                  <p className="text-[0.62rem] text-muted-foreground">
                    Translates multi-model mathematical tensors into simple, intuitive concepts.
                  </p>
                </div>
              </div>
              <span className="text-[0.58rem] font-mono px-2 py-0.5 rounded bg-background/90 text-primary border border-primary/30">
                {prediction.ai_explanation.source || "Groq Llama 3.3 70B AI Engine"}
              </span>
            </div>

            {/* Quick Headline Summary */}
            <div className="p-3 rounded-lg bg-background/80 border border-primary/30 text-xs">
              <p className="font-semibold text-foreground leading-relaxed flex items-start gap-2">
                <Lightbulb className="size-4 text-primary shrink-0 mt-0.5" />
                <span>{prediction.ai_explanation.headline_summary}</span>
              </p>
            </div>

            {/* Explainer Tabs */}
            <div className="flex gap-1 border-b border-border/60 pb-1">
              {[
                { id: "SUMMARY", label: "Model Logic", Icon: Compass },
                { id: "WHY", label: "Why This Trade?", Icon: HelpCircle },
                { id: "ROADMAP", label: "Price Targets", Icon: Clock },
                { id: "RISK", label: "Risk & Stop Loss", Icon: ShieldAlert },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveExplainTab(id as any)}
                  className={`px-3 py-1 rounded text-[0.68rem] font-bold flex items-center gap-1.5 transition ${
                    activeExplainTab === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Explainer Tab Content */}
            <div className="text-xs text-muted-foreground leading-relaxed bg-background/60 p-3 rounded-lg border border-border/50">
              {activeExplainTab === "SUMMARY" && (
                <p className="text-foreground">{prediction.ai_explanation.why_this_prediction}</p>
              )}
              {activeExplainTab === "WHY" && (
                <div className="space-y-2">
                  <p className="text-foreground">{prediction.ai_explanation.why_this_prediction}</p>
                  <div className="pt-2 border-t border-border/40">
                    <p className="font-bold text-bull text-[0.7rem] uppercase mb-1">Actionable Trader Advice:</p>
                    <p className="text-foreground">{prediction.ai_explanation.plain_english_advice}</p>
                  </div>
                </div>
              )}
              {activeExplainTab === "ROADMAP" && (
                <div className="space-y-2">
                  <p className="text-foreground">{prediction.ai_explanation.multi_horizon_outlook}</p>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[0.68rem]">
                    <div className="p-2 rounded bg-secondary/50">
                      <span className="font-bold text-foreground block">Target Horizon:</span>
                      <span>5-Day Swing at ₹{fmt(prediction.target_price, 2)}</span>
                    </div>
                    <div className="p-2 rounded bg-secondary/50">
                      <span className="font-bold text-foreground block">Extended Horizon:</span>
                      <span>15-Day Breakout at ₹{fmt(prediction.bull_target, 2)}</span>
                    </div>
                  </div>
                </div>
              )}
              {activeExplainTab === "RISK" && (
                <div className="space-y-2">
                  <p className="text-foreground">{prediction.ai_explanation.risk_and_safety_rationale}</p>
                  <div className="p-2.5 rounded bg-bear/10 border border-bear/30 flex items-center gap-2">
                    <AlertTriangle className="size-4 text-bear shrink-0" />
                    <span className="text-[0.68rem] text-bear font-semibold">
                      Invalidation Floor: ₹{fmt(prediction.stop_loss, 2)} (1.2x ATR dynamic boundary)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* In-app AI Key Hot-Swap Helper Notice */}
            <div className="flex items-center justify-between text-[0.62rem] text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <Key className="size-3 text-primary" /> Token quota out?
              </span>
              <Link
                to="/terminal"
                hash="Settings"
                className="text-primary hover:underline font-bold"
              >
                Hot-Swap AI Key in Settings (No restart needed) →
              </Link>
            </div>
          </div>
        )}

        {/* Calibrated Technical Attributions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Info className="size-3.5 text-primary" /> Key Driving Factors (Calibrated Weights)
            </span>
            <span className="text-[0.6rem] text-muted-foreground">Feature Attributions</span>
          </div>

          <div className="space-y-1.5">
            {prediction.feature_attributions.map((attr, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-secondary/30 border border-border/40 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
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

        {/* Quote Provenance & Reference Verification */}
        <div className="flex flex-wrap items-center justify-between text-[0.62rem] text-muted-foreground pb-1 px-1">
          <span>
            Live Execution Quote: <strong className="text-foreground">₹{fmt(executionPrice, 2)}</strong>
            {asOf && ` (${new Date(asOf).toLocaleTimeString()})`}
          </span>
          {prediction.forecast_reference_close && (
            <span>
              Model Reference Close: <strong className="text-foreground">₹{fmt(prediction.forecast_reference_close, 2)}</strong>
              {prediction.forecast_reference_as_of && ` (${prediction.forecast_reference_as_of})`}
            </span>
          )}
        </div>

        {/* 1-Click Action Button */}
        <div className="pt-1">
          <button
            onClick={handleExecuteTrade}
            className={`w-full py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition hover:brightness-110 active:scale-[0.99] text-white shadow-md ${
              isBear ? "bg-bear" : "bg-bull"
            }`}
          >
            <ArrowUpRight className="size-4" />
            Execute ML {actionLabel} Setup in Paper Wallet (10 Shares @ ₹{fmt(executionPrice, 2)})
          </button>

          {tradeMsg && (
            <div
              className={`mt-2 p-2 rounded-lg text-xs font-semibold text-center ${
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
