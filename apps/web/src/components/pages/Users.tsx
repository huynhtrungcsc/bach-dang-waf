import { useState, useMemo, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  UserPlus, Key, Trash2, Edit, Loader2, Users as UsersIcon,
  Copy, CheckCircle2, AlertTriangle, Search, ShieldOff, Check, Minus,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { SkeletonTable } from "@/components/ui/skeletons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  useSuspenseUsers, useSuspenseUserStats,
  useCreateUser, useUpdateUser, useDeleteUser,
  useUpdateUserStatus, useResetUserPassword,
} from "@/queries";

// ─── Display helpers ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", moderator: "Operator", viewer: "Observer",
};

const ROLE_DOT: Record<string, string> = {
  admin: "bg-rose-500", moderator: "bg-blue-500", viewer: "bg-slate-400",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500", inactive: "bg-slate-300", suspended: "bg-amber-500",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active", inactive: "Inactive", suspended: "Suspended",
};

function RoleLabel({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ROLE_DOT[role] ?? "bg-slate-400"}`} />
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusText({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[status] ?? "bg-slate-300"}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const ROLE_AVATAR: Record<string, string> = {
  admin:     "/avatar-admin.png",
  moderator: "/avatar-operator.png",
  viewer:    "/avatar-observer.png",
};

function RoleAvatar({ role }: { role: string }) {
  const src = ROLE_AVATAR[role] ?? "/avatar-observer.png";
  return (
    <div className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden select-none">
      <img src={src} alt={role} className="h-5 w-5 object-contain opacity-60" />
    </div>
  );
}

function fmtLogin(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function UserStats() {
  const { data: stats } = useSuspenseUserStats();
  const s = stats.data;

  const items = [
    { label: "Total Accounts",      value: s.total,           sub: `${s.active} active · ${s.inactive} inactive` },
    { label: "Administrators",      value: s.byRole.admin,    sub: "Full-access principals" },
    { label: "Operators",           value: s.byRole.moderator, sub: "Configuration managers" },
    { label: "Sessions (24 h)",     value: s.recentLogins,    sub: "Unique logins last 24 hours" },
  ];

  return (
    <div className="grid grid-cols-4 divide-x divide-slate-100 border border-slate-100 rounded-lg bg-white overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="px-5 py-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">{item.label}</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums leading-none">{item.value}</p>
          <p className="text-[11px] text-slate-400 mt-1">{item.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main table component ────────────────────────────────────────────────────

function UsersTable() {
  const currentUser = useStore((s) => s.currentUser);
  const { data: users } = useSuspenseUsers();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resetPwd, setResetPwd] = useState<{ open: boolean; userId: string; username: string; newPassword?: string }>({ open: false, userId: "", username: "" });
  const [pwdCopied, setPwdCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string; username: string }>({ isOpen: false, userId: "", username: "" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const updateUserStatus = useUpdateUserStatus();
  const resetUserPassword = useResetUserPassword();

  const [form, setForm] = useState({
    username: "", email: "", password: "", fullName: "",
    role: "viewer" as "admin" | "moderator" | "viewer",
    status: "active" as "active" | "inactive" | "suspended",
  });

  const canManage = currentUser?.role === "admin";
  const canView   = currentUser?.role === "admin" || currentUser?.role === "moderator";

  const filtered = useMemo(() => {
    const list: any[] = users.data ?? [];
    return list.filter((u) => {
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.fullName || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [users.data, search, filterRole, filterStatus]);

  const resetForm = () => setForm({ username: "", email: "", password: "", fullName: "", role: "viewer", status: "active" });

  const handleSave = async () => {
    if (!form.username || !form.email || !form.fullName) return toast.error("Username, email, and display name are required");
    if (!editingUser && !form.password) return toast.error("Password is required for new accounts");
    try {
      if (editingUser) {
        await updateUser.mutateAsync({ id: editingUser.id, data: { email: form.email, fullName: form.fullName, role: form.role, status: form.status } });
        toast.success("Account updated");
      } else {
        await createUser.mutateAsync({ username: form.username, email: form.email, password: form.password, fullName: form.fullName, role: form.role, status: form.status as "active" | "inactive" });
        toast.success("Account provisioned");
      }
      setIsDialogOpen(false);
      setEditingUser(null);
      resetForm();
    } catch (e: any) {
      toast.error(editingUser ? "Update failed" : "Provisioning failed", { description: e.response?.data?.message });
    }
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setForm({ username: user.username, email: user.email, password: "", fullName: user.fullName || "", role: user.role, status: user.status });
    setIsDialogOpen(true);
  };

  const handleToggle = async (user: any) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    setTogglingId(user.id);
    try {
      await updateUserStatus.mutateAsync({ id: user.id, status: newStatus });
    } catch (e: any) {
      toast.error("Status update failed", { description: e.response?.data?.message });
    } finally {
      setTogglingId(null);
    }
  };

  const handleResetPwd = async () => {
    try {
      const result = await resetUserPassword.mutateAsync(resetPwd.userId);
      const pwd = result?.data?.temporaryPassword;
      if (!pwd) throw new Error("No temporary password returned");
      const { userId, username } = resetPwd;
      setResetPwd({ open: false, userId: "", username: "" });
      setTimeout(() => { setResetPwd({ open: true, userId, username, newPassword: pwd }); setPwdCopied(false); }, 80);
    } catch (e: any) {
      toast.error("Credential reset failed", { description: e.response?.data?.message || e.message });
      setResetPwd({ open: false, userId: "", username: "" });
    }
  };

  const handleCopyPwd = async () => {
    const pwd = resetPwd.newPassword;
    if (!pwd) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(pwd);
      else {
        const t = document.createElement("textarea");
        t.value = pwd;
        t.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
        document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
      }
      setPwdCopied(true);
      toast.success("Credential copied");
    } catch { toast.error("Copy failed", { description: "Select the text and press Ctrl+C to copy manually." }); }
  };

  const confirmDelete = async () => {
    try {
      await deleteUser.mutateAsync(deleteConfirm.userId);
      setDeleteConfirm({ isOpen: false, userId: "", username: "" });
      toast.success("Account removed");
    } catch (e: any) {
      toast.error("Delete failed", { description: e.response?.data?.message });
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-center">
        <ShieldOff className="h-8 w-8 mb-3 text-slate-200" />
        <p className="text-sm font-medium text-slate-600">Insufficient Privileges</p>
        <p className="text-xs text-slate-400 mt-1">Your role does not have access to identity management</p>
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Identity & Access</h1>
          <p className="text-sm text-slate-400 mt-0.5">Operator accounts and role-based access control</p>
        </div>
        {canManage && (
          <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700"
            onClick={() => { resetForm(); setEditingUser(null); setIsDialogOpen(true); }}>
            <UserPlus className="h-3.5 w-3.5" />
            Provision Account
          </Button>
        )}
      </div>

      {/* Stats */}
      <Suspense fallback={
        <div className="grid grid-cols-4 divide-x divide-slate-100 border border-slate-100 rounded-lg bg-white overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse space-y-2">
              <div className="h-2 bg-slate-100 rounded w-24" />
              <div className="h-6 bg-slate-100 rounded w-8" />
              <div className="h-2 bg-slate-100 rounded w-32" />
            </div>
          ))}
        </div>
      }>
        <UserStats />
      </Suspense>

      {/* Accounts table */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800 mr-1">Accounts</span>
          <span className="text-xs text-slate-400">
            {filtered.length}{filtered.length !== (users.data?.length ?? 0) ? ` of ${users.data?.length}` : ""}
          </span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="pl-7 h-7 text-xs w-52"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Operator</SelectItem>
              <SelectItem value="viewer">Observer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <UsersIcon className="h-7 w-7 mb-2 text-slate-200" />
            <p className="text-sm">No accounts match the current filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Principal</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Auth</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Enabled</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <RoleAvatar role={user.role} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-700 leading-tight">{user.username}</p>
                        {user.fullName && (
                          <p className="text-[11px] text-slate-400 truncate">{user.fullName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{user.email}</td>
                  <td className="px-4 py-3"><RoleLabel role={user.role} /></td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">{fmtLogin(user.lastLogin)}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={user.status === "active"}
                      onCheckedChange={() => handleToggle(user)}
                      disabled={!canManage || togglingId === user.id}
                      className="scale-75 origin-left"
                    />
                  </td>
                  <td className="px-4 py-3"><StatusText status={user.status} /></td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Edit" onClick={() => openEdit(user)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Reset credential" onClick={() => setResetPwd({ open: true, userId: user.id, username: user.username })}>
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" title="Remove" onClick={() => setDeleteConfirm({ isOpen: true, userId: user.id, username: user.username })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Access Role Matrix – permission table */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Access Role Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">Privilege levels and permission boundaries by role</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-28">Role</th>
                {["Sites & SSL", "WAF Rules", "Access Policies", "User Accounts", "Logs & Metrics", "Backup & Restore"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                {
                  role: "admin",
                  desc: "Unrestricted",
                  cells: [
                    { v: "rw" }, { v: "rw" }, { v: "rw" }, { v: "rw" }, { v: "rw" }, { v: "rw" },
                  ],
                },
                {
                  role: "moderator",
                  desc: "Config manager",
                  cells: [
                    { v: "rw" }, { v: "rw" }, { v: "rw" }, { v: "none" }, { v: "r" }, { v: "none" },
                  ],
                },
                {
                  role: "viewer",
                  desc: "Read-only",
                  cells: [
                    { v: "r" }, { v: "r" }, { v: "r" }, { v: "none" }, { v: "r" }, { v: "none" },
                  ],
                },
              ].map((row) => (
                <tr key={row.role} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ROLE_DOT[row.role]}`} />
                      <span className="text-[12px] font-semibold text-slate-700">{ROLE_LABELS[row.role]}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 ml-3.5">{row.desc}</p>
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {cell.v === "rw" && (
                        <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-600">
                          <Check className="h-3 w-3 text-slate-500" />
                          <span className="text-slate-400">R/W</span>
                        </span>
                      )}
                      {cell.v === "r" && (
                        <span className="inline-flex items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
                          <Check className="h-3 w-3 text-slate-300" />
                          <span>Read</span>
                        </span>
                      )}
                      {cell.v === "none" && (
                        <Minus className="h-3 w-3 text-slate-200 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditingUser(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editingUser ? "Edit Account" : "Provision Account"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3.5 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u-username" className="text-xs text-slate-600">Username</Label>
                <Input id="u-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="john.doe" disabled={!!editingUser} className="h-8 text-sm" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-fullname" className="text-xs text-slate-600">Display Name</Label>
                <Input id="u-fullname" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="John Doe" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-email" className="text-xs text-slate-600">Email</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john.doe@company.com" className="h-8 text-sm" />
            </div>
            {!editingUser && (
              <div className="grid gap-1.5">
                <Label htmlFor="u-password" className="text-xs text-slate-600">Initial Password</Label>
                <Input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••" className="h-8 text-sm" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-slate-600">Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Observer</SelectItem>
                    <SelectItem value="moderator">Operator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-slate-600">Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    {editingUser && <SelectItem value="suspended">Suspended</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-slate-800 hover:bg-slate-700" onClick={handleSave}
              disabled={createUser.isPending || updateUser.isPending}>
              {(createUser.isPending || updateUser.isPending)
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Processing…</>
                : editingUser ? "Save Changes" : "Provision Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credential reset dialog */}
      <AlertDialog open={resetPwd.open} onOpenChange={(o) => { if (!o) { setResetPwd({ open: false, userId: "", username: "" }); setPwdCopied(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              {resetPwd.newPassword
                ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Credential Reset — Copy Before Closing</>
                : <><Key className="h-4 w-4 text-slate-500" />Reset Credential</>}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-1">
                {!resetPwd.newPassword ? (
                  <p className="text-xs text-slate-600">
                    Generate a new one-time credential for <strong>{resetPwd.username}</strong>. The current password will be invalidated immediately.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">
                      Temporary credential generated for <strong>{resetPwd.username}</strong>. This value is shown once only.
                    </p>
                    <div className="border border-slate-200 rounded-md p-3 bg-slate-50 space-y-2">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">One-time Credential</p>
                      <div className="flex gap-2">
                        <input
                          type="text" value={resetPwd.newPassword} readOnly
                          onClick={(e) => e.currentTarget.select()}
                          className="flex-1 font-mono text-sm bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleCopyPwd}>
                          {pwdCopied ? <><CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Transmit via secure channel only. Cannot be retrieved after this dialog is closed.
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {!resetPwd.newPassword ? (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPwd} disabled={resetUserPassword.isPending}
                  className="bg-slate-800 hover:bg-slate-700">
                  {resetUserPassword.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Resetting…</> : "Reset Credential"}
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => { setResetPwd({ open: false, userId: "", username: "" }); setPwdCopied(false); }}>Done</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirm.isOpen}
        onOpenChange={(o) => !o && setDeleteConfirm({ isOpen: false, userId: "", username: "" })}
        title="Remove Account"
        description={
          <div className="space-y-1">
            <p>Remove account <strong>{deleteConfirm.username}</strong>?</p>
            <p className="text-xs text-slate-500">All sessions and access tokens will be invalidated. This cannot be undone.</p>
          </div>
        }
        confirmText="Remove Account"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        isLoading={deleteUser.isPending}
        variant="destructive"
      />
    </>
  );
}

// ─── Page root ───────────────────────────────────────────────────────────────

const Users = () => (
  <div className="space-y-4">
    <Suspense fallback={<SkeletonTable rows={6} columns={6} title="Identity & Access" />}>
      <UsersTable />
    </Suspense>
  </div>
);

export default Users;
