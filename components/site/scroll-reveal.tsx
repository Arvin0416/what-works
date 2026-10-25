"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  repeat?: boolean;
  rootMargin?: string;
  threshold?: number;
};

const DEFAULT_ROOT_MARGIN = "0px 0px -12% 0px";
const DEFAULT_THRESHOLD = 0.12;

export function ScrollReveal({
  children,
  className,
  repeat = false,
  rootMargin = DEFAULT_ROOT_MARGIN,
  threshold = DEFAULT_THRESHOLD,
}: ScrollRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    setIsReady(true);

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (!repeat) {
            observer.disconnect();
          }
        } else if (repeat) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [repeat, rootMargin, threshold]);

  const classes = ["scroll-reveal", isVisible && "is-visible", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={elementRef}
      className={classes}
      data-reveal-ready={isReady ? "true" : undefined}
    >
      {children}
    </div>
  );
}
