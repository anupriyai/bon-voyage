"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Sample exchange rates for illustration only. Every amount in the engine is in US dollars.
export const CURRENCIES = [
  { code: "USD", name: "US dollar", rate: 1, pre: "US$" },
  { code: "EUR", name: "Euro", rate: 0.92, pre: "€" },
  { code: "GBP", name: "British pound", rate: 0.79, pre: "£" },
  { code: "AED", name: "UAE dirham", rate: 3.6725, pre: "AED " },
  { code: "SAR", name: "Saudi riyal", rate: 3.75, pre: "SAR " },
  { code: "JOD", name: "Jordanian dinar", rate: 0.709, pre: "JOD " },
  { code: "EGP", name: "Egyptian pound", rate: 48.5, pre: "EGP " },
  { code: "TRY", name: "Turkish lira", rate: 41.5, pre: "TRY " },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
type Currency = (typeof CURRENCIES)[number];

const KEY = "bv-currency";

function convert(n: number, c: Currency): number {
  const v = Math.abs(n) * c.rate;
  return v >= 10000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10;
}

interface Ctx {
  cur: Currency;
  setCur: (code: CurrencyCode) => void;
  /** "US$4,620". Negative amounts get a true minus sign. */
  money: (usd: number) => string;
  /** "+US$340" / "−US$340" / "No change". */
  signed: (usd: number) => string;
  /** "US$25,000–50,000" */
  range: (lo: number, hi: number) => string;
}

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>("USD");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCode(saved as CurrencyCode);
    } catch {
      // Storage blocked; keep US dollars.
    }
  }, []);

  const setCur = useCallback((next: CurrencyCode) => {
    setCode(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Ignore.
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const cur = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
    const money = (n: number) => (n < 0 ? "−" : "") + cur.pre + convert(n, cur).toLocaleString("en-US");
    const signed = (n: number) => {
      const v = convert(n, cur);
      if (v === 0) return "No change";
      return (n > 0 ? "+" : "−") + cur.pre + v.toLocaleString("en-US");
    };
    const range = (lo: number, hi: number) => money(lo) + "–" + convert(hi, cur).toLocaleString("en-US");
    return { cur, setCur, money, signed, range };
  }, [code, setCur]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
