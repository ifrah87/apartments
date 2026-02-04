"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Shield, Trash2, UserRound, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type UserRow = {
  id: string;
  phone: string;
  role: "admin" | "reception";
  created_at: string;
  updated_at: string;
};

export default function AdminSettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "reception" as UserRow["role"],
    permissions: [] as string[],
  });

  const roleMeta = useMemo(
    () => ({
      admin: {
        label: "ADMIN",
        badge: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
        stripe: "border-sky-400",
        icon: Shield,
      },
      reception: {
        label: "RECEPTION TEAM",
        badge: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        stripe: "border-amber-400",
        icon: UserRound,
      },
    }),
    []
  );

  const securityTypes = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard" },
      { id: "units", label: "Units" },
      { id: "readings", label: "Readings" },
      { id: "bills", label: "Bills" },
      { id: "leases", label: "Leases" },
      { id: "expenses", label: "Expenses" },
      { id: "services", label: "Services" },
      { id: "team", label: "Team" },
      { id: "settings", label: "Settings" },
    ],
    []
  );

  const loadUsers = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/users", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load users.");
        return res.json();
      })
      .then((data) => setUsers(data.users || []))
      .catch((err) => setError(err.message || "Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateRole = async (id: string, role: "admin" | "reception") => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role }),
    });
    if (!res.ok) {
      setError("Failed to update role.");
      return;
    }
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role } : user)));
  };

  const handleAddMember = (event: React.FormEvent) => {
    event.preventDefault();
    setAddOpen(false);
    setForm({ username: "", password: "", role: "reception", permissions: [] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500">Manage access roles for Admin and Customer Service staff.</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-sky-300"
        >
          <Plus className="h-4 w-4" />
          Add Team Member
        </button>
      </header>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : (
        <SectionCard className="space-y-4 border border-slate-200 bg-white p-4">
          {users.map((user) => {
            const meta = roleMeta[user.role];
            const RoleIcon = meta.icon;
            return (
              <div
                key={user.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 ${meta.stripe} border-l-4`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/10 text-slate-600">
                    <RoleIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-slate-900">{user.phone}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">ID: #{user.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateRole(user.id, user.role === "admin" ? "reception" : "admin")}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                    aria-label="Toggle role"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-white p-2 text-rose-500 hover:bg-rose-50"
                    aria-label="Delete user"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      <div
        className={`fixed right-0 top-0 z-40 h-full w-full max-w-sm border-l border-slate-200 bg-white shadow-xl transition duration-300 ${
          addOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <form onSubmit={handleAddMember} className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Add Member</h2>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Username</label>
              <input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="e.g. jame_smith"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Password</label>
              <input
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                type="password"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Access Level</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRow["role"] }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
              >
                <option value="admin">ADMIN</option>
                <option value="reception">RECEPTION TEAM</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-600">Security Access</label>
              <div className="grid grid-cols-1 gap-2">
                {securityTypes.map((item) => {
                  const checked = form.permissions.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            permissions: checked
                              ? prev.permissions.filter((perm) => perm !== item.id)
                              : [...prev.permissions, item.id],
                          }))
                        }
                        className="h-4 w-4 accent-sky-400"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-sky-300"
          >
            <Save className="h-4 w-4" />
            Add Member
          </button>
        </form>
      </div>
    </div>
  );
}
