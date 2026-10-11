"use client";

import React, { useEffect, useState } from "react";

interface AnimatedKpiValueProps {
  value: number;
  unit?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedKpiValue({
  value,
  unit = "L",
  duration = 900,
  className = ""
}: AnimatedKpiValueProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(ease * value);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {displayValue.toLocaleString("en-IN")}
      {unit && <span className="unit"> {unit}</span>}
    </span>
  );
}
