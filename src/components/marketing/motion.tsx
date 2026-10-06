"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-stagger], [data-chaos]";

/**
 * One IntersectionObserver for the whole marketing page: marks elements with
 * `data-in` the first time they scroll into view. All the actual motion lives in
 * landing.css, which only hides elements when scripting runs and the visitor
 * hasn't asked for reduced motion — so content is never stranded.
 */
export function MotionRoot() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(SELECTOR);
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-in", "");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
