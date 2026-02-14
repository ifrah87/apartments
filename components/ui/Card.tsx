import React from "react";

type Props = React.PropsWithChildren<{ className?: string }>;

export function Card({ className = "", children }: Props) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface/80 bg-gradient-to-br from-white/5 to-transparent shadow-card-soft backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export const Panel = Card;
