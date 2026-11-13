"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Reveal content as it enters the viewport, including later assistant steps. */
export default function PageMotion() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const targets = "[data-reveal], .home-section, .home-sample, .flow-section > div, .panel, .card-d";
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        entry.target.animate(
          [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 750, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" },
        );
      }
    }, { threshold: .08 });
    const scan = () => document.querySelectorAll(targets).forEach((element) => {
      if (seen.has(element)) return;
      seen.add(element); observer.observe(element);
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [path]);
  return null;
}
