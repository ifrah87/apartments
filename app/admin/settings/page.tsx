"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Shield, Trash2, UserRound, X } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

type UserRow = {
  id: string;
  name?: string | null;
  phone: string;
  role: "admin" | "reception";
  permissions?: string[];
  created_at: string;
  updated_at: string;
};

export default function AdminSettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionRole, setSessionRole] = useState<"admin" | "reception" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
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
    fetch("/api/admin/users", { cache: "no-store", credentials: "include" })
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

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => setSessionRole(data?.role ?? null))
      .catch(() => setSessionRole(null));
  }, []);

  const canEditSecurity = sessionRole === "admin";

  const openAdd = () => {
    if (!canEditSecurity) {
      setError("Only admins can edit security levels.");
      return;
    }
    setError("");
    setDrawerMode("add");
    setEditingId(null);
    setForm({ name: "", phone: "", password: "", role: "reception", permissions: [] });
    setDrawerOpen(true);
  };

  const openEdit = (user: UserRow) => {
    if (!canEditSecurity) {
      setError("Only admins can edit security levels.");
      return;
    }
    setError("");
    setDrawerMode("edit");
    setEditingId(user.id);
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      password: "",
      role: user.role,
      permissions: user.permissions || [],
    });
    setDrawerOpen(true);
  };

  const deleteUser = async (id: string) => {
    if (!canEditSecurity) {
      setError("Only admins can delete team members.");
      return;
    }
    if (!confirm("Delete this team member?")) return;
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete user.");
      }
      setUsers((prev) => prev.filter((user) => user.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    }
  };

  const handleSaveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditSecurity) {
      setError("Only admins can add or edit security levels.");
      return;
    }
    setError("");
    try {
      if (drawerMode === "add") {
        if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) {
          setError("Name, phone, and password are required.");
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            password: form.password,
            role: form.role,
            permissions: form.permissions,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to add member.");
        }
        setUsers((prev) => [data.user, ...prev.filter((user) => user.id !== data.user.id)]);
      } else if (editingId) {
        if (!form.name.trim() || !form.phone.trim()) {
          setError("Name and phone are required.");
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingId,
            name: form.name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            permissions: form.permissions,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "Failed to update member.");
        }
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingId
              ? { ...user, name: form.name.trim(), phone: form.phone.trim(), role: form.role, permissions: form.permissions }
              : user,
          ),
        );
      }
      setDrawerOpen(false);
      setDrawerMode("add");
      setEditingId(null);
      setForm({ name: "", phone: "", password: "", role: "reception", permissions: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save member.");
    }
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
          onClick={openAdd}
          disabled={!canEditSecurity}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
            canEditSecurity ? "bg-sky-400 text-slate-900 hover:bg-sky-300" : "bg-slate-200 text-slate-400"
          }`}
        >
          <Plus className="h-4 w-4" />
          Add Team Member
        </button>
      </header>

      {!canEditSecurity ? (
        <p className="text-xs text-amber-600">Only admins can edit security levels.</p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-slate-500">Loading users…</p>
      ) : (
        <SectionCard className="space-y-4 border border-slate-200 bg-white p-4">
          {users.map((user) => {
            const meta = roleMeta[user.role];
            const RoleIcon = meta.icon;
            const displayName = (user.name || "").trim() || "User";
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
                      <span className="text-lg font-semibold text-slate-900">{displayName || "Unnamed user"}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {user.phone ? `Phone: ${user.phone}` : "Phone: —"} · ID: #{user.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(user)}
                    disabled={!canEditSecurity}
                    className={`rounded-lg border p-2 ${
                      canEditSecurity
                        ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        : "border-slate-200 bg-slate-100 text-slate-300"
                    }`}
                    aria-label="Edit member"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border p-2 ${
                      canEditSecurity
                        ? "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"
                        : "border-slate-200 bg-slate-100 text-slate-300"
                    }`}
                    aria-label="Delete user"
                    disabled={!canEditSecurity}
                    onClick={() => deleteUser(user.id)}
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
          drawerOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <form onSubmit={handleSaveMember} className="flex h-full flex-col overflow-y-auto p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {drawerMode === "add" ? "Add Member" : "Edit Member"}
            </h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="e.g. Jame Smith"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Phone</label>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="e.g. 613533329"
              />
            </div>
            {drawerMode === "add" ? (
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
            ) : (
              <p className="text-xs text-slate-500">Password changes are handled separately.</p>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Access Level</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRow["role"] }))}
                disabled={!canEditSecurity}
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
                        disabled={!canEditSecurity}
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
            disabled={!canEditSecurity}
            className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition ${
              canEditSecurity ? "bg-sky-400 text-slate-900 hover:bg-sky-300" : "bg-slate-200 text-slate-400"
            }`}
          >
            <Save className="h-4 w-4" />
            {drawerMode === "add" ? "Add Member" : "Update Member"}
          </button>
        </form>
      </div>
    </div>
  );
}
