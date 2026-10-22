"use client";

import { useEffect, useState } from "react";

const FLIGHT = "M368 710 C 330 640, 215 600, 225 575 C 235 545, 330 480, 420 430 S 700 270, 1010 215";

/** Dashed flight path with a plane that flies it on a loop. Holds still if the visitor prefers reduced motion. */
export default function HeroPath() {
  const [still, setStill] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(q.matches);
    const on = () => setStill(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  return (
    <svg className="hero-path" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <path
        id="flight-path"
        className="hero-dash"
        d={FLIGHT}
        fill="none"
        stroke="#b4f0d6"
        strokeOpacity="0.85"
        strokeWidth="1.5"
        strokeDasharray="5 7"
      />
      <circle cx="368" cy="710" r="4.5" fill="#b4f0d6" />
      <g transform="translate(1010 215)" fill="#b4f0d6">
        <circle r="5" />
        {!still && (
          <circle r="5" fillOpacity="0.5">
            <animate attributeName="r" values="5;22" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="0.5;0" dur="2.4s" repeatCount="indefinite" />
          </circle>
        )}
      </g>

      {/* The plane points along +x and turns with the path. */}
      <g fill="#b4f0d6" transform={still ? "translate(420 430) rotate(-30)" : undefined}>
        <circle r="20" fillOpacity="0.16" />
        <g transform="scale(1.35)">
          <path d="M-13 -2 H9 Q17 0 9 2 H-13 Z" />
          <path d="M-1 -2 L-9 -14 H-5 L5 -2 Z" />
          <path d="M-1 2 L-9 14 H-5 L5 2 Z" />
          <path d="M-11 -2 L-16 -8 H-13 L-7 -2 Z" />
          <path d="M-11 2 L-16 8 H-13 L-7 2 Z" />
        </g>
        {!still && (
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
            <mpath href="#flight-path" />
          </animateMotion>
        )}
      </g>
    </svg>
  );
}
