"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { COORDINATOR, recordsFor, type RecordItem } from "@/lib/data";
import { firstName } from "@/lib/engine";
import { plural } from "@/lib/format";
import { isTranslated, recordProgress, translationDaysLeft, useCase, type RecFile } from "@/lib/store";
import { CheckIcon, LockIcon, UploadIcon } from "@/components/Icons";

function toRecFiles(list: FileList | File[]): RecFile[] {
  const at = new Date().toISOString();
  return Array.from(list).map((f) => ({ name: f.name, size: f.size, at }));
}

function fmtSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1000))} KB`;
}

function RecordRow({ item, now }: { item: RecordItem; now: Date }) {
  const { state, update } = useCase();
  const input = useRef<HTMLInputElement>(null);
  const entry = state.records[item.id];
  const files = entry?.files ?? [];
  const has = files.length > 0;
  const allTranslated = has && files.every((f) => isTranslated(f, now));
  const pending = files.filter((f) => !isTranslated(f, now));
  const docDate = files.find((f) => f.docDate)?.docDate;

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = toRecFiles(list);
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [item.id]: { ...s.records[item.id], files: [...(s.records[item.id]?.files ?? []), ...incoming] },
      },
    }));
  };
  const remove = (idx: number) =>
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [item.id]: { ...s.records[item.id], files: (s.records[item.id]?.files ?? []).filter((_, n) => n !== idx) },
      },
    }));
  const toggleCourier = () =>
    update((s) => ({
      ...s,
      records: {
        ...s.records,
        [item.id]: { files: s.records[item.id]?.files ?? [], courier: !s.records[item.id]?.courier },
      },
    }));

  return (
    <li className="rec">
      <div className="rec-main">
        <p className="rec-title">
          <strong>{item.title}</strong>
          {docDate && <span className="rec-date"> · {docDate}</span>}
          {item.optional && <span className="tag">Optional</span>}
        </p>
        <div className="status-row">
          {has ? (
            <>
              <span className="chip-s chip-ok">Received</span>
              {allTranslated ? (
                <span className="chip-s chip-ok">Translated to English</span>
              ) : (
                <span className="chip-s chip-info">
                  Translating — ready in {plural(translationDaysLeft(pending[0], now), "day")}
                </span>
              )}
            </>
          ) : entry?.courier ? (
            <span className="chip-s chip-info">Courier requested — we will confirm pickup</span>
          ) : (
            <>
              <span className="chip-s chip-warn">Missing</span>
              <span className="chip-s chip-muted">Translation starts after upload</span>
            </>
          )}
        </div>
        {item.hint && <p className="rec-hint">{item.hint}</p>}
        {has && (
          <ul className="file-list">
            {files.map((f, n) => (
              <li key={`${f.name}-${n}`}>
                <span>
                  {f.name} <small>· {fmtSize(f.size)}</small>
                </span>
                <button type="button" className="link-btn" onClick={() => remove(n)} aria-label={`Remove ${f.name}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rec-actions">
        {item.physical && !has && (
          <button type="button" className="btn btn-outline-dark btn-sm" onClick={toggleCourier}>
            {entry?.courier ? "Cancel courier" : "Arrange courier"}
          </button>
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => input.current?.click()}>
          {has ? "Add more" : "Upload"}
        </button>
      </div>
    </li>
  );
}

export default function RecordsPage() {
  const { state, update, openChat } = useCase();
  const [drag, setDrag] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const now = new Date();
  const items = recordsFor(state.intake.diagnosis);
  const progress = recordProgress(state, now);
  const groups = Array.from(new Set(items.map((r) => r.group)));
  const missingItems = items.filter((r) => !r.optional && !(state.records[r.id]?.files.length ?? 0));
  const patient = firstName(state.intake.patientName) || "the patient";
  const manager = firstName(state.intake.managerName) || "You";

  const addUnsorted = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = toRecFiles(list);
    update((s) => ({ ...s, unsorted: [...s.unsorted, ...incoming] }));
  };
  const assign = (idx: number, recordId: string) => {
    update((s) => {
      const file = s.unsorted[idx];
      if (!file) return s;
      return {
        ...s,
        unsorted: s.unsorted.filter((_, n) => n !== idx),
        records: {
          ...s.records,
          [recordId]: { ...s.records[recordId], files: [...(s.records[recordId]?.files ?? []), file] },
        },
      };
    });
  };
  const addDemo = () => {
    const at = new Date(Date.now() - 3 * 86400000).toISOString();
    update((s) => {
      const records = { ...s.records };
      for (const r of items) {
        if (r.optional || r.physical || (records[r.id]?.files.length ?? 0) > 0) continue;
        records[r.id] = { files: [{ name: `${r.id.split(".")[1]}-sample.pdf`, size: 900_000, at }] };
      }
      return { ...s, records };
    });
  };

  const pct = progress.total ? (progress.ready / progress.total) * 100 : 0;

  return (
    <div className="page">
      <h2 className="page-title">Medical records, in one place</h2>
      <p className="page-lede">
        Upload once. Every hospital you consider receives one complete, translated file — so tests aren&apos;t repeated
        without a good reason.
      </p>

      <div className="split-layout">
        <div className="split-main">
          <section className="card ready-card" aria-label="Records progress">
            <div className="ready-top">
              <h3>
                {progress.ready} of {progress.total} needed records ready
              </h3>
              {progress.missing > 0 ? (
                <span className="ready-missing">{progress.missing} still missing</span>
              ) : progress.translating > 0 ? (
                <span className="ready-translating">{progress.translating} translating</span>
              ) : (
                <span className="ready-done">
                  <CheckIcon width={14} height={14} /> All ready
                </span>
              )}
            </div>
            <div
              className="meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.ready}
              aria-label="Records ready"
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            {progress.translating > 0 && progress.missing > 0 && (
              <p className="ready-note">{plural(progress.translating, "record")} being translated.</p>
            )}
          </section>

          <section
            className={`dropzone${drag ? " is-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addUnsorted(e.dataTransfer.files);
            }}
          >
            <UploadIcon width={30} height={30} />
            <div className="dropzone-text">
              <strong>Add files from your phone or computer</strong>
              <span>Scans, PDFs, photos of paper reports, or files saved from WhatsApp all work.</span>
            </div>
            <input
              ref={pick}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addUnsorted(e.target.files);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => pick.current?.click()}>
              Choose files
            </button>
          </section>

          {state.unsorted.length > 0 && (
            <section className="card unsorted" aria-label="Files to sort">
              <h3>Files waiting to be sorted</h3>
              <p className="rec-hint">Tell us what each file is, or leave it and your coordinator will sort it.</p>
              <ul>
                {state.unsorted.map((f, n) => (
                  <li key={`${f.name}-${n}`}>
                    <span>
                      {f.name} <small>· {fmtSize(f.size)}</small>
                    </span>
                    <select
                      aria-label={`What is ${f.name}?`}
                      value=""
                      onChange={(e) => e.target.value && assign(n, e.target.value)}
                    >
                      <option value="">This is…</option>
                      {items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.map((g) => (
            <section key={g} className="card rec-group">
              <h3 className="rec-group-title">{g}</h3>
              <ul>
                {items
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <RecordRow key={r.id} item={r} now={now} />
                  ))}
              </ul>
            </section>
          ))}

          <p className="rec-demo">
            Prototype shortcut:{" "}
            <button type="button" className="link-btn" onClick={addDemo}>
              add sample files for every record
            </button>
          </p>
        </div>

        <aside className="split-side">
          <section className="card side-card">
            <h3>Why this matters</h3>
            <p>
              Hospitals abroad often repeat tests when records are incomplete or older than 4–6 weeks. Filling the gaps at
              home first is usually cheaper and faster.
            </p>
            {missingItems.length > 0 && (
              <button
                type="button"
                className="link-btn"
                onClick={() => openChat(`Hi ${COORDINATOR.name.split(" ")[0]}, I need help getting: ${missingItems[0].title}.`)}
              >
                Ask for help with {missingItems[0].title.toLowerCase()}
              </button>
            )}
          </section>

          <section className="card side-card">
            <div className="side-title">
              <LockIcon width={20} height={20} />
              <h3>Who can see these records</h3>
            </div>
            <dl className="who">
              <div>
                <dt>
                  {manager}
                  {state.intake.forWhom === "family" ? " (you)" : ""}
                </dt>
                <dd>Manages the case</dd>
              </div>
              {state.intake.forWhom === "family" && (
                <div>
                  <dt>{patient}</dt>
                  <dd>{state.intake.patientSeesAll ? "Can see everything" : "Sees what you share"}</dd>
                </div>
              )}
              <div>
                <dt>{COORDINATOR.name}</dt>
                <dd>Your coordinator</dd>
              </div>
              <div>
                <dt>Specialist panel</dt>
                <dd>Only after you request a review</dd>
              </div>
            </dl>
            <p className="side-fine">
              A hospital only sees records after you choose to share them. Prototype: nothing is uploaded — file names are
              kept in this browser only.
            </p>
          </section>

          <div className="side-cta">
            <Link href="/case/second-opinion" className="btn btn-primary btn-block">
              Next: request a second opinion
            </Link>
            <Link href="/case/options" className="btn btn-outline-dark btn-block">
              Skip to treatment options
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
