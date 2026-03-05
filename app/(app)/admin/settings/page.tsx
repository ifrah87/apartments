"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Save, Shield, Trash2, UserRound, X, ShieldCheck, Calculator } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import SectionCard from "@/components/ui/SectionCard";

type AppRole = "admin" | "manager" | "accountant" | "reception";

type UserRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  role: AppRole;
  permissions?: string[];
  created_at: string;
  updated_at: string;
};

type AttendanceRow = {
  id: string;
  userId: string;
  name?: string | null;
  phone?: string | null;
  role?: AppRole | null;
  clockInAt: string;
  clockOutAt?: string | null;
  status: "signed_in" | "signed_out";
};

const ALL_SECTIONS = [
  { id: "dashboard",   label: "Dashboard" },
  { id: "properties",  label: "Properties" },
  { id: "units",       label: "Units" },
  { id: "readings",    label: "Readings" },
  { id: "bills",       label: "Bills" },
  { id: "bank",        label: "Bank" },
  { id: "leases",      label: "Leases" },
  { id: "services",    label: "Services" },
  { id: "reports",     label: "Reports" },
  { id: "settings",    label: "Settings" },
  { id: "team",        label: "Team" },
] as const;

const ROLES: { id: AppRole; label: string }[] = [
  { id: "manager",    label: "Manager" },
  { id: "accountant", label: "Accountant" },
  { id: "reception",  label: "Reception" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatAttendanceTime(value?: string | null) {
  if (!value) return "Signed in";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormatter.format(date);
}

export default function AdminSettingsPage() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionRole, setSessionRole] = useState<"admin" | "reception" | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "reception" as AppRole,
    permissions: [] as string[],
  });
  const [activeTab, setActiveTab] = useState<"team" | "roles">("team");
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [savingRolePerms, setSavingRolePerms] = useState(false);

  const roleMeta = useMemo(
    () => ({
      admin:       { label: "Admin",       badge: "bg-sky-500/15 text-sky-300 border border-sky-500/30",     stripe: "border-sky-400",    icon: Shield },
      manager:     { label: "Manager",     badge: "bg-purple-500/15 text-purple-300 border border-purple-500/30", stripe: "border-purple-400", icon: ShieldCheck },
      accountant:  { label: "Accountant",  badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30", stripe: "border-emerald-400", icon: Calculator },
      reception:   { label: "Reception",   badge: "bg-amber-500/15 text-amber-300 border border-amber-500/30",  stripe: "border-amber-400",  icon: UserRound },
    }),
    []
  );

  const loadUsers = () => {
    setLoading(true);
    setError("");
    fetch("/api/admin/users", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("Log in as an admin to manage team members.");
          }
          throw new Error(data?.error || "Failed to load users.");
        }
        return data;
      })
      .then((data) => {
        setUsers(data.users || []);
        setAttendance(data.attendance || []);
      })
      .catch((err) => setError(err.message || "Failed to load users."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        const role = data?.role ?? null;
        const authenticated = Boolean(data?.authenticated);
        setSessionRole(role);
        setSessionChecked(true);
        if (role === "admin") {
          loadUsers();
          fetch("/api/admin/role-permissions", { cache: "no-store", credentials: "include" })
            .then(r => r.json()).then(p => { if (p.ok) setRolePermissions(p.data ?? {}); }).catch(() => {});
          return;
        }
        setLoading(false);
        setError(
          authenticated
            ? "Only admins can manage team members."
            : "Log in as an admin to manage team members.",
        );
      })
      .catch(() => {
        setSessionRole(null);
        setSessionChecked(true);
        setLoading(false);
        setError("Log in as an admin to manage team members.");
      });
  }, []);

  const canEditSecurity = sessionRole === "admin";

  const toggleRolePerm = (role: string, section: string) => {
    setRolePermissions(prev => {
      const current = prev[role] ?? [];
      const next = current.includes(section) ? current.filter(p => p !== section) : [...current, section];
      return { ...prev, [role]: next };
    });
  };

  const saveRolePermissions = async () => {
    setSavingRolePerms(true);
    try {
      const res = await fetch("/api/admin/role-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(rolePermissions),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Failed to save");
      setRolePermissions(data.data ?? rolePermissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSavingRolePerms(false);
    }
  };

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
    const confirmed = await confirm({
      title: "Delete Team Member",
      message: "Delete this team member? This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
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
        if (!form.name.trim() || !form.password.trim()) {
          setError("Login name and 4-digit PIN are required.");
          return;
        }
        if (!/^\d{4}$/.test(form.password.trim())) {
          setError("PIN must be exactly 4 digits.");
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
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
        if (!form.name.trim()) {
          setError("Login name is required.");
          return;
        }
        if (form.password.trim() && !/^\d{4}$/.test(form.password.trim())) {
          setError("PIN must be exactly 4 digits.");
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingId,
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            password: form.password.trim() || undefined,
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
              ? { ...user, name: form.name.trim(), phone: form.phone.trim() || null, role: form.role, permissions: form.permissions }
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
          <p className="text-sm text-slate-500">Manage name-based logins and 4-digit PIN access for Admin and Customer Service staff.</p>
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

      {sessionChecked && !canEditSecurity ? (
        <p className="text-xs text-amber-600">Only admins can edit security levels.</p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {[{ id: "team", label: "Team Members" }, { id: "roles", label: "Roles & Permissions" }].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as "team" | "roles")}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? "border-sky-400 text-sky-600" : "border-transparent text-slate-400 hover:text-slate-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "team" && (
      <SectionCard className="border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900/5 text-slate-700">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Attendance Log</h2>
            <p className="text-sm text-slate-500">
              Each team member signs in with their own login. Sign-in and sign-out times are recorded here.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Member</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Sign In</th>
                <th className="py-2 pr-4 font-medium">Sign Out</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length ? (
                attendance.map((row) => {
                  const roleLabels: Record<string, string> = { admin: "Admin", manager: "Manager", accountant: "Accountant", reception: "Reception" };
                  const role = roleLabels[row.role ?? ""] ?? (row.role ?? "—");
                  const displayName = (row.name || "").trim() || row.phone || "User";
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-3 pr-4 text-slate-900">
                        <div className="font-medium">{displayName}</div>
                        {row.phone ? <div className="text-xs text-slate-500">{row.phone}</div> : null}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{role}</td>
                      <td className="py-3 pr-4 text-slate-600">{formatAttendanceTime(row.clockInAt)}</td>
                      <td className="py-3 pr-4 text-slate-600">
                        {row.clockOutAt ? formatAttendanceTime(row.clockOutAt) : "Still signed in"}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.status === "signed_in"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.status === "signed_in" ? "Signed In" : "Signed Out"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    No attendance records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      )}
      {loading ? (
        activeTab === "team" && <p className="text-sm text-slate-500">Loading users…</p>
      ) : (
        activeTab === "team" && <SectionCard className="space-y-4 border border-slate-200 bg-white p-4">
          {users.map((user) => {
            const meta = roleMeta[user.role] ?? roleMeta.reception;
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
                      {user.phone ? `Contact: ${user.phone}` : "No contact number"} · ID: #{user.id}
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

      {/* Roles & Permissions tab */}
      {activeTab === "roles" && (
        <SectionCard className="border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Roles & Permissions</h2>
              <p className="text-sm text-slate-500">Control which sections each role can access. Admin always has full access.</p>
            </div>
            <button
              type="button"
              onClick={saveRolePermissions}
              disabled={savingRolePerms || !canEditSecurity}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingRolePerms ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4 text-left font-semibold text-slate-600">Section</th>
                  {/* Admin — locked */}
                  <th className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-700">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  </th>
                  {ROLES.map(role => (
                    <th key={role.id} className="px-3 py-2 text-center">
                      <span className="text-xs font-semibold text-slate-600">{role.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_SECTIONS.map(section => (
                  <tr key={section.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{section.label}</td>
                    {/* Admin always checked, disabled */}
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked readOnly disabled className="h-4 w-4 accent-sky-400 opacity-50" />
                    </td>
                    {ROLES.map(role => {
                      const checked = (rolePermissions[role.id] ?? []).includes(section.id);
                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canEditSecurity}
                            onChange={() => toggleRolePerm(role.id, section.id)}
                            className="h-4 w-4 accent-sky-400"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <label className="text-sm font-semibold text-slate-600">Login Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="e.g. Ahmed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Phone (Optional)</label>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                placeholder="Contact number for staff records"
              />
            </div>
            {drawerMode === "add" ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">4-Digit PIN</label>
                <input
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                  placeholder="1234"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">Reset 4-Digit PIN</label>
                <input
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
                  placeholder="Leave blank to keep current PIN"
                />
                <p className="text-xs text-slate-500">
                  Enter a new 4-digit PIN only if you want to reset this team member&apos;s login.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600">Role</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as AppRole }))}
                disabled={!canEditSecurity}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-300"
              >
                <option value="admin">Admin — Full Access</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="reception">Reception</option>
              </select>
              <p className="text-xs text-slate-400">Permissions for each role are set in the Roles & Permissions tab.</p>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-600">Security Access</label>
              <div className="grid grid-cols-1 gap-2">
                {ALL_SECTIONS.map((item) => {
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
