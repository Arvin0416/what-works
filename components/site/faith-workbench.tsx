"use client";

import { useEffect, useRef, useState } from "react";

import { ScrollReveal } from "./scroll-reveal";

export type FaithWorkbenchStep = {
  id: string;
  label: string;
  body: string;
};

type FaithWorkbenchProps = {
  steps: FaithWorkbenchStep[];
};

export function FaithWorkbench({ steps }: FaithWorkbenchProps) {
  const firstStep = steps[0];
  const [activeStepId, setActiveStepId] = useState(firstStep?.id ?? "");
  const stepRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!firstStep || typeof window === "undefined") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visibleEntry) {
          const nextStepId = (visibleEntry.target as HTMLElement).dataset.stepId;
          if (nextStepId) {
            setActiveStepId(nextStepId);
          }
        }
      },
      { threshold: [0.25, 0.6], rootMargin: "-18% 0px -48%" },
    );

    for (const step of steps) {
      const stepElement = stepRefs.current[step.id];
      if (stepElement) {
        observer.observe(stepElement);
      }
    }

    return () => observer.disconnect();
  }, [firstStep, steps]);

  if (!firstStep) {
    return null;
  }

  const activeStep = steps.find((step) => step.id === activeStepId) ?? firstStep;
  const panelId = "faith-workbench-panel";

  function selectStep(stepId: string) {
    setActiveStepId(stepId);
  }

  return (
    <section
      id="workbench"
      className="faith-workbench"
      aria-labelledby="workbench-heading"
    >
      <div className="site-container faith-workbench__layout">
        <ScrollReveal className="faith-workbench__copy">
          <p className="section-kicker">A practice for the moment</p>
          <h2 id="workbench-heading">What works in this moment?</h2>
          <p>
            Move through four small responses. The order is simple, but the
            invitation is serious: stay honest, stay close to Jesus, and bring
            another wise person in when you need support.
          </p>

          <div
            className="faith-workbench__controls"
            role="group"
            aria-label="Choose a response"
          >
            {steps.map((step) => (
              <button
                key={step.id}
                className="faith-workbench__control"
                type="button"
                aria-controls={panelId}
                aria-pressed={activeStepId === step.id}
                onClick={() => selectStep(step.id)}
              >
                {step.label}
              </button>
            ))}
          </div>
        </ScrollReveal>

        <div className="faith-workbench__panel" id={panelId} aria-live="polite">
          <p className="faith-workbench__panel-label">Active step</p>
          <h3 key={`label-${activeStep.id}`}>{activeStep.label}</h3>
          <p key={`body-${activeStep.id}`}>{activeStep.body}</p>
        </div>

        <ScrollReveal className="faith-workbench__steps-reveal" rootMargin="0px 0px -8% 0px">
          <ol className="faith-workbench__steps scroll-stagger">
            {steps.map((step, index) => (
              <li
                key={step.id}
                id={`faith-workbench-step-${step.id}`}
                className={`faith-workbench__step${
                  activeStepId === step.id ? " faith-workbench__step--active" : ""
                }`}
                data-step-id={step.id}
                ref={(element) => {
                  stepRefs.current[step.id] = element;
                }}
              >
                <span className="faith-workbench__step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </ScrollReveal>
      </div>
    </section>
  );
}
