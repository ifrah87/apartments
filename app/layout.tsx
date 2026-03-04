import "./globals.css";

// Root layout — bare HTML shell only.
// AppShell + providers live in app/(app)/layout.tsx
// Public nav + footer live in app/(marketing)/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
