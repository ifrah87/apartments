// components/ui/SectionCard.tsx
type Props = React.PropsWithChildren<{ className?: string }>;
export default function SectionCard({ className = "", children }: Props) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}
