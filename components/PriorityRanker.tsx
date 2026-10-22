"use client";

import { PRIORITY_BY_ID, type PriorityId } from "@/lib/data";
import { ChevronDownIcon, ChevronUpIcon } from "./Icons";

export default function PriorityRanker({
  order,
  onChange,
}: {
  order: PriorityId[];
  onChange: (next: PriorityId[]) => void;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <ol className="rank-list">
      {order.map((id, i) => {
        const p = PRIORITY_BY_ID[id];
        return (
          <li key={id} className="rank-item">
            <span className="rank-num" aria-hidden="true">
              {i + 1}
            </span>
            <div className="rank-text">
              <strong>{p.label}</strong>
              <span>{p.desc}</span>
            </div>
            <div className="rank-btns">
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${p.label} up`}
              >
                <ChevronUpIcon width={18} height={18} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${p.label} down`}
              >
                <ChevronDownIcon width={18} height={18} />
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
