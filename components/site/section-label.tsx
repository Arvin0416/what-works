import type { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function SectionLabel({
  children,
  className = "",
}: SectionLabelProps) {
  return <p className={`section-label ${className}`.trim()}>{children}</p>;
}
