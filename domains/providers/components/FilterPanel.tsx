"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Close } from "@/shared/ui/Icons";

export default function FilterPanel({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const [mobile, setMobile] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 960px)");
    const update = () => { if (!query.matches) dialog.current?.close(); setMobile(query.matches); };
    update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update);
  }, []);
  const close = () => { dialog.current?.close(); trigger.current?.focus(); };
  if (!mobile) return <aside className="explore-filter-container" aria-label="Filter care options">{children}</aside>;
  return <aside className="explore-filter-container"><button ref={trigger} type="button" className="explore-filter-trigger" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">Filter care options {activeCount > 0 && <span>{activeCount} active</span>}<span aria-hidden="true">☰</span></button><dialog ref={dialog} className="explore-filter-dialog" aria-labelledby="care-filter-title" onClose={() => trigger.current?.focus()} onClick={(event) => { if (event.target === dialog.current) close(); }}><div className="explore-filter-dialog-heading"><h2 id="care-filter-title">Refine your search</h2><button type="button" aria-label="Close filters" onClick={close}><Close size={21} /></button></div><div onClickCapture={(event) => { if ((event.target as HTMLElement).closest('button[type="submit"]')) close(); }}>{children}</div></dialog></aside>;
}
