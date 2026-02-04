"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4">
      <form onSubmit={handleSubmit} className="w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="text-sm text-slate-500">Use your phone number and password.</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
            placeholder="+252..."
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
            placeholder="••••••••"
            required
          />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
