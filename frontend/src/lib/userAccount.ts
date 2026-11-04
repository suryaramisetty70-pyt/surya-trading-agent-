/**
 * User Account, Profile & Institutional Preferences Engine
 * Manages:
 * 1. User Profile & Demat / KYC credentials
 * 2. Margin & Fund Management (Deposit / Withdraw / Margin allocations)
 * 3. Trading Preferences (Sound FX, Default lots, Product types)
 * 4. Risk Controls (Daily Loss Limit / Kill Switch, Max Order Value)
 * 5. Notifications & Alerts Drawer Feed
 */

import { useState, useEffect } from "react";

export type UserProfile = {
  name: string;
  clientId: string;
  email: string;
  phone: string;
  tier: string;
  kycStatus: "VERIFIED" | "PENDING" | "REJECTED";
  panMasked: string;
  dematDpId: string;
  primaryBank: string;
  segments: string[];
};

export type TradingPreferences = {
  soundEffects: boolean;
  defaultProductType: "CNC" | "MIS" | "NRML";
  defaultNiftyLots: number;
  defaultBankNiftyLots: number;
  slippageTolerancePct: number;
  autoSquareOffTime: string;
  killSwitchEnabled: boolean;
  maxDailyLossLimit: number;
  maxSingleOrderValue: number;
};

export type NotificationItem = {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "ORDER" | "ALERT" | "RISK" | "SYSTEM";
  read: boolean;
};

const DEFAULT_PROFILE: UserProfile = {
  name: "Surya Ramisetty",
  clientId: "SURYA-NSE-8842",
  email: "surya.trader@nexus.ai",
  phone: "+91 98765 43210",
  tier: "INSTITUTIONAL PRO",
  kycStatus: "VERIFIED",
  panMasked: "ABCDE····F",
  dematDpId: "IN300120-19284912",
  primaryBank: "HDFC Bank (A/C ····4921)",
  segments: ["NSE Cash", "BSE Cash", "NSE Equity F&O", "BSE F&O", "Commodity (MCX)"],
};

const DEFAULT_PREFERENCES: TradingPreferences = {
  soundEffects: true,
  defaultProductType: "CNC",
  defaultNiftyLots: 1,
  defaultBankNiftyLots: 1,
  slippageTolerancePct: 0.1,
  autoSquareOffTime: "15:20 IST",
  killSwitchEnabled: false,
  maxDailyLossLimit: 50000,
  maxSingleOrderValue: 200000,
};

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif_1",
    timestamp: "10:30 AM",
    title: "Order Executed",
    message: "Bought 10 TCS @ ₹2,499.10 via Paper Wallet",
    type: "ORDER",
    read: false,
  },
  {
    id: "notif_2",
    timestamp: "10:15 AM",
    title: "Breakout Screener Trigger",
    message: "BHARTIARTL broke 52-Week High with 2.56x volume surge",
    type: "ALERT",
    read: false,
  },
  {
    id: "notif_3",
    timestamp: "09:15 AM",
    title: "Market Session Open",
    message: "NSE & BSE regular trading session is now active",
    type: "SYSTEM",
    read: true,
  },
];

const ACCOUNT_EVENT = "surya_account_updated";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, val: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event(ACCOUNT_EVENT));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

export function playTradeSound() {
  if (typeof window === "undefined") return;
  const prefs = loadFromStorage<TradingPreferences>("surya_trading_preferences", DEFAULT_PREFERENCES);
  if (!prefs.soundEffects) return;

  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
}

export function useUserAccount() {
  const [profile, setProfileState] = useState<UserProfile>(() =>
    loadFromStorage("surya_user_profile", DEFAULT_PROFILE)
  );
  const [preferences, setPreferencesState] = useState<TradingPreferences>(() =>
    loadFromStorage("surya_trading_preferences", DEFAULT_PREFERENCES)
  );
  const [notifications, setNotificationsState] = useState<NotificationItem[]>(() =>
    loadFromStorage("surya_notifications", INITIAL_NOTIFICATIONS)
  );

  useEffect(() => {
    const handleUpdate = () => {
      setProfileState(loadFromStorage("surya_user_profile", DEFAULT_PROFILE));
      setPreferencesState(loadFromStorage("surya_trading_preferences", DEFAULT_PREFERENCES));
      setNotificationsState(loadFromStorage("surya_notifications", INITIAL_NOTIFICATIONS));
    };
    window.addEventListener(ACCOUNT_EVENT, handleUpdate);
    return () => window.removeEventListener(ACCOUNT_EVENT, handleUpdate);
  }, []);

  const updateProfile = (partial: Partial<UserProfile>) => {
    const next = { ...profile, ...partial };
    setProfileState(next);
    saveToStorage("surya_user_profile", next);
  };

  const updatePreferences = (partial: Partial<TradingPreferences>) => {
    const next = { ...preferences, ...partial };
    setPreferencesState(next);
    saveToStorage("surya_trading_preferences", next);
  };

  const addNotification = (title: string, message: string, type: NotificationItem["type"] = "ALERT") => {
    const newItem: NotificationItem = {
      id: `notif_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      title,
      message,
      type,
      read: false,
    };
    const next = [newItem, ...notifications.slice(0, 49)];
    setNotificationsState(next);
    saveToStorage("surya_notifications", next);
  };

  const markAllNotificationsRead = () => {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotificationsState(next);
    saveToStorage("surya_notifications", next);
  };

  const clearNotifications = () => {
    setNotificationsState([]);
    saveToStorage("surya_notifications", []);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    profile,
    preferences,
    notifications,
    unreadCount,
    updateProfile,
    updatePreferences,
    addNotification,
    markAllNotificationsRead,
    clearNotifications,
  };
}
