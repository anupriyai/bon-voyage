"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ORIGINS, type DxId, type Intake, type OriginId } from "@/lib/data";
import { useCase } from "@/lib/store";
import { LockIcon, SearchIcon } from "./Icons";

function matchDiagnosis(text: string): Pick<Intake, "diagnosis" | "diagnosisOther"> {
  const t = text.toLowerCase();
  const hit: [RegExp, DxId][] = [
    [/colon|rectal|rectum|bowel|colorectal/, "colon"],
    [/breast/, "breast"],
    [/prostate/, "prostate"],
    [/lung/, "lung"],
  ];
  for (const [re, id] of hit) if (re.test(t)) return { diagnosis: id, diagnosisOther: "" };
  return { diagnosis: "other", diagnosisOther: text.trim() };
}

function matchOrigin(text: string): Pick<Intake, "origin" | "originOther"> {
  const t = text.toLowerCase();
  const hit: [RegExp, OriginId][] = [
    [/jordan|amman|irbid|zarqa|aqaba/, "jordan"],
    [/saudi|riyadh|jeddah|ksa/, "saudi"],
    [/uae|emirates|dubai|abu dhabi|sharjah/, "uae"],
    [/lebanon|beirut/, "lebanon"],
    [/egypt|cairo|alexandria/, "egypt"],
    [/united kingdom|\buk\b|britain|england|london|scotland|wales/, "uk"],
    [/new zealand|\bnz\b|auckland|wellington|christchurch/, "nz"],
  ];
  for (const [re, id] of hit) if (re.test(t)) return { origin: id, originOther: "" };
  return { origin: "other", originOther: text.trim() };
}

/** Short starter on the landing page. The full intake happens in the 5-step flow at /start. */
export default function CareRequestForm() {
  const router = useRouter();
  const { startDraft } = useCase();
  const [treatment, setTreatment] = useState("");
  const [origin, setOrigin] = useState("");

  return (
    <form
      className="request-card"
      onSubmit={(e) => {
        e.preventDefault();
        // Pre-fills a draft request. A finished case is never touched; /start opens a separate draft.
        startDraft({ ...matchDiagnosis(treatment), ...matchOrigin(origin) });
        router.push("/start");
      }}
    >
      <h2>Tell us what you need</h2>
      <p className="request-sub">Takes about two minutes. No medical records needed yet.</p>

      <label className="field">
        <span>Diagnosis or specialty</span>
        <div className="input-icon">
          <SearchIcon width={18} height={18} />
          <input
            type="text"
            name="treatment"
            placeholder="e.g. colon cancer, breast cancer"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            required
          />
        </div>
      </label>

      <label className="field">
        <span>Where does the patient live?</span>
        <input
          type="text"
          name="origin"
          list="origin-list"
          placeholder="Country or city"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
        />
        <datalist id="origin-list">
          {ORIGINS.filter((o) => o.id !== "other").map((o) => (
            <option key={o.id} value={o.label} />
          ))}
        </datalist>
      </label>

      <button type="submit" className="btn btn-primary btn-block">
        Find my care options
      </button>

      <p className="request-note">
        <LockIcon width={14} height={14} />
        Next we ask about language, priorities and budget. Medical records come later, once you choose to share them.
      </p>
    </form>
  );
}
