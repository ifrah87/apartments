// components/ui/SectionCard.tsx
import React from "react";

type Props = React.PropsWithChildren<{ className?: string }>;
export default function SectionCard({ className = "", children }: Props) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-panel/80 bg-gradient-to-br from-white/5 to-transparent shadow-card-soft backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
