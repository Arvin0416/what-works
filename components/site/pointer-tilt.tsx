"use client";

import type { PointerEvent, ReactNode } from "react";

type PointerTiltProps = {
  children: ReactNode;
  className?: string;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function PointerTilt({ children, className = "" }: PointerTiltProps) {
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || prefersReducedMotion()) {
      return;
    }

    const element = event.currentTarget;
    const bounds = element.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const rotateX = (0.5 - y) * 5;
    const rotateY = (x - 0.5) * 5;

    element.style.setProperty("--pointer-x", `${x * 100}%`);
    element.style.setProperty("--pointer-y", `${y * 100}%`);
    element.style.setProperty("--pointer-rotate-x", `${rotateX}deg`);
    element.style.setProperty("--pointer-rotate-y", `${rotateY}deg`);
  }

  function resetPointerPosition(event: PointerEvent<HTMLDivElement>) {
    const element = event.currentTarget;

    element.style.setProperty("--pointer-x", "50%");
    element.style.setProperty("--pointer-y", "50%");
    element.style.setProperty("--pointer-rotate-x", "0deg");
    element.style.setProperty("--pointer-rotate-y", "0deg");
  }

  return (
    <div
      className={`pointer-tilt ${className}`.trim()}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointerPosition}
    >
      {children}
    </div>
  );
}
