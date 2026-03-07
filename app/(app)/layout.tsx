import { ConfirmProvider } from "@/components/ConfirmProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import AppShell from "@/components/AppShell";

// All ERP routes (app.orfanerealestate.so) use this layout.
// Auth is enforced by proxy.ts — no extra guard needed here.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ConfirmProvider>
        <AppShell>{children}</AppShell>
      </ConfirmProvider>
    </LanguageProvider>
  );
}
