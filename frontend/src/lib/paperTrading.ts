import { useState, useEffect } from "react";

export type Position = {
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
};

export type TradeRecord = {
  id: string;
  timestamp: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
};

export type PortfolioState = {
  cash: number;
  positions: Position[];
  trades: TradeRecord[];
};

const STORAGE_KEY = "surya_paper_trading_portfolio_v1";
const INITIAL_CASH = 1000000; // 10 Lakhs INR

function getInitialState(): PortfolioState {
  if (typeof window === "undefined") {
    return { cash: INITIAL_CASH, positions: [], trades: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to parse paper trading state", e);
  }
  return { cash: INITIAL_CASH, positions: [], trades: [] };
}

function saveState(state: PortfolioState) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event("surya-portfolio-updated"));
    } catch (e) {
      console.error("Failed to save paper trading state", e);
    }
  }
}

export function buyStock(symbol: string, name: string, price: number, quantity: number) {
  if (quantity <= 0 || price <= 0) {
    return { success: false, message: "Invalid quantity or price" };
  }
  const totalCost = price * quantity;
  const state = getInitialState();

  if (state.cash < totalCost) {
    return {
      success: false,
      message: `Insufficient virtual cash. Required ₹${totalCost.toLocaleString("en-IN")}, Available ₹${state.cash.toLocaleString("en-IN")}`,
    };
  }

  state.cash -= totalCost;
  const existingIdx = state.positions.findIndex((p) => p.symbol.toUpperCase() === symbol.toUpperCase());

  if (existingIdx >= 0) {
    const curr = state.positions[existingIdx]!;
    const totalQty = curr.quantity + quantity;
    const totalSpent = curr.avgBuyPrice * curr.quantity + totalCost;
    curr.avgBuyPrice = totalSpent / totalQty;
    curr.quantity = totalQty;
    curr.currentPrice = price;
  } else {
    state.positions.push({
      symbol: symbol.toUpperCase(),
      name,
      quantity,
      avgBuyPrice: price,
      currentPrice: price,
    });
  }

  state.trades.unshift({
    id: "tx_" + Date.now(),
    timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + ", " + new Date().toLocaleDateString("en-IN"),
    symbol: symbol.toUpperCase(),
    type: "BUY",
    quantity,
    price,
    total: totalCost,
  });

  saveState(state);
  return { success: true, message: `Successfully bought ${quantity} shares of ${symbol} at ₹${price.toFixed(2)}` };
}

export function sellStock(symbol: string, price: number, quantity: number) {
  if (quantity <= 0 || price <= 0) {
    return { success: false, message: "Invalid quantity or price" };
  }
  const state = getInitialState();
  const existingIdx = state.positions.findIndex((p) => p.symbol.toUpperCase() === symbol.toUpperCase());

  if (existingIdx < 0 || state.positions[existingIdx]!.quantity < quantity) {
    const available = existingIdx >= 0 ? state.positions[existingIdx]!.quantity : 0;
    return { success: false, message: `Cannot sell ${quantity} shares. You only own ${available} shares of ${symbol}.` };
  }

  const curr = state.positions[existingIdx]!;
  const proceeds = price * quantity;
  state.cash += proceeds;
  curr.quantity -= quantity;
  curr.currentPrice = price;

  if (curr.quantity <= 0) {
    state.positions.splice(existingIdx, 1);
  }

  state.trades.unshift({
    id: "tx_" + Date.now(),
    timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + ", " + new Date().toLocaleDateString("en-IN"),
    symbol: symbol.toUpperCase(),
    type: "SELL",
    quantity,
    price,
    total: proceeds,
  });

  saveState(state);
  return { success: true, message: `Successfully sold ${quantity} shares of ${symbol} at ₹${price.toFixed(2)}` };
}

export function depositCash(amount: number) {
  if (amount <= 0) return { success: false, message: "Invalid deposit amount" };
  const state = getInitialState();
  state.cash += amount;
  state.trades.unshift({
    id: "tx_dep_" + Date.now(),
    timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + ", " + new Date().toLocaleDateString("en-IN"),
    symbol: "FUNDS_DEPOSIT",
    type: "BUY",
    quantity: 1,
    price: amount,
    total: amount,
  });
  saveState(state);
  return { success: true, message: `Successfully added ₹${amount.toLocaleString("en-IN")} virtual funds!` };
}

export function withdrawCash(amount: number) {
  if (amount <= 0) return { success: false, message: "Invalid withdrawal amount" };
  const state = getInitialState();
  if (state.cash < amount) {
    return { success: false, message: `Insufficient cash balance to withdraw ₹${amount.toLocaleString("en-IN")}` };
  }
  state.cash -= amount;
  state.trades.unshift({
    id: "tx_wth_" + Date.now(),
    timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + ", " + new Date().toLocaleDateString("en-IN"),
    symbol: "FUNDS_WITHDRAWAL",
    type: "SELL",
    quantity: 1,
    price: amount,
    total: amount,
  });
  saveState(state);
  return { success: true, message: `Successfully withdrew ₹${amount.toLocaleString("en-IN")} funds!` };
}

export function resetPaperPortfolio() {
  const initial = { cash: INITIAL_CASH, positions: [], trades: [] };
  saveState(initial);
}

export function usePaperTrading() {
  const [portfolio, setPortfolio] = useState<PortfolioState>(getInitialState);

  useEffect(() => {
    const handleUpdate = () => {
      setPortfolio(getInitialState());
    };
    window.addEventListener("surya-portfolio-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("surya-portfolio-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const holdingsValue = portfolio.positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  const totalInvested = portfolio.positions.reduce((sum, p) => sum + p.quantity * p.avgBuyPrice, 0);
  const unrealizedPnL = holdingsValue - totalInvested;
  const unrealizedPnLPct = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;
  const netPortfolioValue = portfolio.cash + holdingsValue;

  return {
    ...portfolio,
    holdingsValue,
    totalInvested,
    unrealizedPnL,
    unrealizedPnLPct,
    netPortfolioValue,
    buyStock,
    sellStock,
    depositCash,
    withdrawCash,
    resetPaperPortfolio,
  };
}
