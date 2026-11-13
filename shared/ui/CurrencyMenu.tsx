"use client";

import { useEffect, useRef, useState } from "react";
import { CURRENCIES, useCurrency } from "@/shared/lib/currency";
import { Check, Chevron, GlobeIcon } from "@/shared/ui/Icons";

export default function CurrencyMenu({ note = "Sample exchange rates for illustration." }: { note?: string }) {
  const { cur, setCur } = useCurrency();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        type="button"
        className="pill-btn bv-ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Prices shown in ${cur.name}. Change currency`}
      >
        <GlobeIcon size={16} style={{ color: "var(--mint)" }} />
        <span style={{ minWidth: "2.2em" }}>{cur.code}</span>
        <Chevron size={14} style={{ transition: "transform .25s ease", transform: `rotate(${open ? 180 : 0}deg)` }} />
      </button>
      {open && (
        <div className="cur-menu bv-menu">
          <p className="eyebrow" style={{ fontWeight: 700, letterSpacing: "0.08em" }}>
            Show prices in
          </p>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              className="cur-opt bv-opt"
              aria-pressed={c.code === cur.code}
              onClick={() => {
                setCur(c.code);
                setOpen(false);
              }}
            >
              <span style={{ width: 42, fontWeight: 700 }}>{c.code}</span>
              <span style={{ flex: 1, color: "var(--ink-mute)" }}>{c.name}</span>
              {c.code === cur.code && <Check size={16} style={{ color: "var(--teal)" }} />}
            </button>
          ))}
          <p style={{ lineHeight: 1.4 }}>{note}</p>
        </div>
      )}
    </div>
  );
}
