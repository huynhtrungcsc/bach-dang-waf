import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Key, Shield, Activity, Eye, EyeOff,
  Copy, CheckCircle2, Loader2, ShieldCheck, ShieldOff,
} from "lucide-react";
import { UserProfile, ActivityLog } from "@/types";
import { toast } from "sonner";
import { accountService } from "@/services/auth.service";
import i18n from "@/lib/i18n";

// ─── Timezones ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "UTC",                            label: "UTC (GMT+0)" },
  { value: "America/New_York",               label: "America/New York (GMT-5/-4)" },
  { value: "America/Toronto",                label: "America/Toronto (GMT-5/-4)" },
  { value: "America/Chicago",                label: "America/Chicago (GMT-6/-5)" },
  { value: "America/Denver",                 label: "America/Denver (GMT-7/-6)" },
  { value: "America/Phoenix",                label: "America/Phoenix (GMT-7)" },
  { value: "America/Los_Angeles",            label: "America/Los Angeles (GMT-8/-7)" },
  { value: "America/Vancouver",              label: "America/Vancouver (GMT-8/-7)" },
  { value: "America/Anchorage",              label: "America/Anchorage (GMT-9/-8)" },
  { value: "America/Honolulu",               label: "America/Honolulu (GMT-10)" },
  { value: "America/Sao_Paulo",              label: "America/Sao Paulo (GMT-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Buenos Aires (GMT-3)" },
  { value: "America/Mexico_City",            label: "America/Mexico City (GMT-6/-5)" },
  { value: "America/Bogota",                 label: "America/Bogota (GMT-5)" },
  { value: "America/Lima",                   label: "America/Lima (GMT-5)" },
  { value: "America/Santiago",               label: "America/Santiago (GMT-4/-3)" },
  { value: "America/Caracas",                label: "America/Caracas (GMT-4)" },
  { value: "Europe/London",                  label: "Europe/London (GMT+0/+1)" },
  { value: "Europe/Lisbon",                  label: "Europe/Lisbon (GMT+0/+1)" },
  { value: "Europe/Dublin",                  label: "Europe/Dublin (GMT+0/+1)" },
  { value: "Europe/Paris",                   label: "Europe/Paris (GMT+1/+2)" },
  { value: "Europe/Berlin",                  label: "Europe/Berlin (GMT+1/+2)" },
  { value: "Europe/Amsterdam",               label: "Europe/Amsterdam (GMT+1/+2)" },
  { value: "Europe/Brussels",                label: "Europe/Brussels (GMT+1/+2)" },
  { value: "Europe/Madrid",                  label: "Europe/Madrid (GMT+1/+2)" },
  { value: "Europe/Rome",                    label: "Europe/Rome (GMT+1/+2)" },
  { value: "Europe/Zurich",                  label: "Europe/Zurich (GMT+1/+2)" },
  { value: "Europe/Vienna",                  label: "Europe/Vienna (GMT+1/+2)" },
  { value: "Europe/Stockholm",               label: "Europe/Stockholm (GMT+1/+2)" },
  { value: "Europe/Warsaw",                  label: "Europe/Warsaw (GMT+1/+2)" },
  { value: "Europe/Prague",                  label: "Europe/Prague (GMT+1/+2)" },
  { value: "Europe/Budapest",                label: "Europe/Budapest (GMT+1/+2)" },
  { value: "Europe/Athens",                  label: "Europe/Athens (GMT+2/+3)" },
  { value: "Europe/Helsinki",                label: "Europe/Helsinki (GMT+2/+3)" },
  { value: "Europe/Bucharest",               label: "Europe/Bucharest (GMT+2/+3)" },
  { value: "Europe/Kiev",                    label: "Europe/Kyiv (GMT+2/+3)" },
  { value: "Europe/Istanbul",                label: "Europe/Istanbul (GMT+3)" },
  { value: "Europe/Moscow",                  label: "Europe/Moscow (GMT+3)" },
  { value: "Europe/Minsk",                   label: "Europe/Minsk (GMT+3)" },
  { value: "Asia/Jerusalem",                 label: "Asia/Jerusalem (GMT+2/+3)" },
  { value: "Asia/Beirut",                    label: "Asia/Beirut (GMT+2/+3)" },
  { value: "Africa/Cairo",                   label: "Africa/Cairo (GMT+2)" },
  { value: "Asia/Baghdad",                   label: "Asia/Baghdad (GMT+3)" },
  { value: "Asia/Riyadh",                    label: "Asia/Riyadh (GMT+3)" },
  { value: "Africa/Nairobi",                 label: "Africa/Nairobi (GMT+3)" },
  { value: "Asia/Tehran",                    label: "Asia/Tehran (GMT+3:30)" },
  { value: "Asia/Dubai",                     label: "Asia/Dubai (GMT+4)" },
  { value: "Asia/Muscat",                    label: "Asia/Muscat (GMT+4)" },
  { value: "Asia/Baku",                      label: "Asia/Baku (GMT+4)" },
  { value: "Asia/Tbilisi",                   label: "Asia/Tbilisi (GMT+4)" },
  { value: "Africa/Johannesburg",            label: "Africa/Johannesburg (GMT+2)" },
  { value: "Africa/Lagos",                   label: "Africa/Lagos (GMT+1)" },
  { value: "Asia/Kabul",                     label: "Asia/Kabul (GMT+4:30)" },
  { value: "Asia/Karachi",                   label: "Asia/Karachi (GMT+5)" },
  { value: "Asia/Tashkent",                  label: "Asia/Tashkent (GMT+5)" },
  { value: "Asia/Kolkata",                   label: "Asia/Kolkata (GMT+5:30)" },
  { value: "Asia/Colombo",                   label: "Asia/Colombo (GMT+5:30)" },
  { value: "Asia/Kathmandu",                 label: "Asia/Kathmandu (GMT+5:45)" },
  { value: "Asia/Dhaka",                     label: "Asia/Dhaka (GMT+6)" },
  { value: "Asia/Almaty",                    label: "Asia/Almaty (GMT+6)" },
  { value: "Asia/Yangon",                    label: "Asia/Yangon (GMT+6:30)" },
  { value: "Asia/Bangkok",                   label: "Asia/Bangkok (GMT+7)" },
  { value: "Asia/Ho_Chi_Minh",               label: "Asia/Ho Chi Minh (GMT+7)" },
  { value: "Asia/Jakarta",                   label: "Asia/Jakarta (GMT+7)" },
  { value: "Asia/Phnom_Penh",                label: "Asia/Phnom Penh (GMT+7)" },
  { value: "Asia/Vientiane",                 label: "Asia/Vientiane (GMT+7)" },
  { value: "Asia/Kuala_Lumpur",              label: "Asia/Kuala Lumpur (GMT+8)" },
  { value: "Asia/Singapore",                 label: "Asia/Singapore (GMT+8)" },
  { value: "Asia/Hong_Kong",                 label: "Asia/Hong Kong (GMT+8)" },
  { value: "Asia/Shanghai",                  label: "Asia/Shanghai (GMT+8)" },
  { value: "Asia/Taipei",                    label: "Asia/Taipei (GMT+8)" },
  { value: "Asia/Manila",                    label: "Asia/Manila (GMT+8)" },
  { value: "Australia/Perth",                label: "Australia/Perth (GMT+8)" },
  { value: "Asia/Seoul",                     label: "Asia/Seoul (GMT+9)" },
  { value: "Asia/Tokyo",                     label: "Asia/Tokyo (GMT+9)" },
  { value: "Australia/Darwin",               label: "Australia/Darwin (GMT+9:30)" },
  { value: "Australia/Brisbane",             label: "Australia/Brisbane (GMT+10)" },
  { value: "Australia/Sydney",               label: "Australia/Sydney (GMT+10/+11)" },
  { value: "Australia/Melbourne",            label: "Australia/Melbourne (GMT+10/+11)" },
  { value: "Pacific/Guam",                   label: "Pacific/Guam (GMT+10)" },
  { value: "Pacific/Auckland",               label: "Pacific/Auckland (GMT+12/+13)" },
  { value: "Pacific/Fiji",                   label: "Pacific/Fiji (GMT+12)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator", moderator: "Operator", viewer: "Observer",
};
const ROLE_DOT: Record<string, string> = {
  admin: "bg-rose-500", moderator: "bg-blue-500", viewer: "bg-slate-400",
};
const ACT_TYPE: Record<string, { dot: string; label: string }> = {
  login:         { dot: "bg-emerald-500", label: "Authentication" },
  logout:        { dot: "bg-slate-400",   label: "Sign-out" },
  security:      { dot: "bg-amber-500",   label: "Security" },
  config_change: { dot: "bg-blue-400",    label: "Config Change" },
  user_action:   { dot: "bg-slate-400",   label: "User Action" },
};

function fmtTs(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString([], {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAgo(d?: string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000)       return "just now";
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Tab items ────────────────────────────────────────────────────────────────

type Section = "profile" | "security" | "mfa" | "audit";

const TAB_ITEMS: { id: Section; icon: React.ElementType; label: string }[] = [
  { id: "profile",  icon: User,     label: "Profile" },
  { id: "security", icon: Key,      label: "Credential" },
  { id: "mfa",      icon: Shield,   label: "MFA" },
  { id: "audit",    icon: Activity, label: "Audit Trail" },
];

// ─── Row field helper ─────────────────────────────────────────────────────────

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-6 px-5 py-3.5 border-b border-slate-50 last:border-0">
      <div className="pt-1">
        <p className="text-[12px] font-medium text-slate-700">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({ profile, onReload }: {
  profile: UserProfile & { twoFactorEnabled: boolean };
  onReload: () => void;
}) {
  const [form, setForm] = useState({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone || "",
    timezone: profile.timezone || "UTC",
    language: profile.language || "en",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await accountService.updateProfile(form);
      // Apply language change immediately
      if (form.language && form.language !== i18n.language) {
        await i18n.changeLanguage(form.language);
        localStorage.setItem('waf-language', form.language);
      }
      onReload();
      toast.success("Profile updated");
    } catch (e: any) {
      toast.error("Update failed", { description: e.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Identity stat strip — Performance-style hairline grid */}
      <div className="grid grid-cols-4 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden">
        <div className="bg-white px-5 py-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Display Name</span>
          <span className="text-[15px] font-bold text-slate-800 leading-tight truncate">{profile.fullName}</span>
          <span className="text-[11px] text-slate-400">@{profile.username}</span>
        </div>
        <div className="bg-white px-5 py-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Role</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ROLE_DOT[profile.role] ?? "bg-slate-400"}`} />
            <span className="text-[15px] font-bold text-slate-800">{ROLE_LABEL[profile.role] ?? profile.role}</span>
          </div>
          <span className="text-[11px] text-slate-400">Access level</span>
        </div>
        <div className="bg-white px-5 py-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Account Created</span>
          <span className="text-[15px] font-bold text-slate-800 tabular-nums">{fmtTs(profile.createdAt)}</span>
          <span className="text-[11px] text-slate-400">Registration date</span>
        </div>
        <div className="bg-white px-5 py-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Last Authentication</span>
          <span className="text-[15px] font-bold text-slate-800 tabular-nums">{fmtAgo(profile.lastLogin)}</span>
          <span className="text-[11px] text-slate-400">Session activity</span>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Profile Information</span>
        </div>

        <FieldRow label="Display Name" sub="Shown across all consoles">
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="h-7 text-xs max-w-sm" />
        </FieldRow>
        <FieldRow label="Email Address" sub="Used for notifications and recovery">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-7 text-xs max-w-sm" />
        </FieldRow>
        <FieldRow label="Contact Number" sub="Optional — format: +1 555 000 0000">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 000 0000" className="h-7 text-xs max-w-sm" />
        </FieldRow>
        <FieldRow label="Timezone" sub="Log timestamps and scheduled task display">
          <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
            <SelectTrigger className="h-7 text-xs max-w-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-xs">{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Interface Language" sub="Console display language">
          <Select value={form.language} onValueChange={(v: any) => setForm({ ...form, language: v })}>
            <SelectTrigger className="h-7 text-xs max-w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">English</SelectItem>
              <SelectItem value="vi" className="text-xs">Tiếng Việt</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="flex justify-end px-5 py-3 bg-slate-50/50 border-t border-slate-100">
          <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Credential section ───────────────────────────────────────────────────────

function CredentialSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ cur: false, nxt: false, con: false });
  const [saving, setSaving] = useState(false);

  const pwChecks = [
    { ok: form.newPassword.length >= 8,        label: "8+ characters" },
    { ok: /[A-Z]/.test(form.newPassword),      label: "Uppercase" },
    { ok: /[a-z]/.test(form.newPassword),      label: "Lowercase" },
    { ok: /\d/.test(form.newPassword),         label: "Number" },
    { ok: /[@$!%*?&]/.test(form.newPassword),  label: "Special char" },
  ];

  const handleChange = async () => {
    if (form.newPassword !== form.confirmPassword) return toast.error("Passwords do not match");
    if (!pwChecks.every((c) => c.ok)) return toast.error("Password does not meet requirements");
    setSaving(true);
    try {
      await accountService.changePassword(form);
      toast.success("Credential updated");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e: any) {
      toast.error("Credential update failed", { description: e.response?.data?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800">Change Password</span>
        <span className="text-xs text-slate-400">Min. 8 chars · uppercase · lowercase · number · special character (@$!%*?&amp;)</span>
      </div>

      <FieldRow label="Current Password" sub="Your active login password">
        <div className="relative max-w-sm">
          <Input id="pw-cur" type={show.cur ? "text" : "password"} value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="h-7 text-xs pr-8" />
          <button type="button" onClick={() => setShow((s) => ({ ...s, cur: !s.cur }))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show.cur ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </FieldRow>

      <FieldRow label="New Password" sub="Must meet all requirements below">
        <div className="space-y-1.5 max-w-sm">
          <div className="relative">
            <Input id="pw-new" type={show.nxt ? "text" : "password"} value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="h-7 text-xs pr-8" />
            <button type="button" onClick={() => setShow((s) => ({ ...s, nxt: !s.nxt }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {show.nxt ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
          {form.newPassword && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {pwChecks.map((c) => (
                <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? "text-emerald-600" : "text-slate-400"}`}>
                  <span className={`h-1 w-1 rounded-full ${c.ok ? "bg-emerald-500" : "bg-slate-200"}`} />
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </FieldRow>

      <FieldRow label="Confirm Password" sub="Repeat new password">
        <div className="relative max-w-sm">
          <Input id="pw-con" type={show.con ? "text" : "password"} value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            className="h-7 text-xs pr-8" />
          <button type="button" onClick={() => setShow((s) => ({ ...s, con: !s.con }))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {show.con ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </FieldRow>

      <div className="flex justify-end px-5 py-3 bg-slate-50/50 border-t border-slate-100">
        <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700" onClick={handleChange} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Update Credential
        </Button>
      </div>
    </div>
  );
}

// ─── MFA section ──────────────────────────────────────────────────────────────

function MFASection({ profile }: { profile: UserProfile & { twoFactorEnabled: boolean } }) {
  const [enabled, setEnabled] = useState(profile.twoFactorEnabled);
  const [setup, setSetup] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
  const [token, setToken] = useState("");
  const [disablePwd, setDisablePwd] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch { toast.error("Copy failed"); }
  };

  const startSetup = async () => {
    setLoading(true);
    try { setSetup(await accountService.setup2FA()); }
    catch (e: any) { toast.error("MFA setup failed", { description: e.response?.data?.message }); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (token.length !== 6) return toast.error("Enter a 6-digit TOTP code");
    setLoading(true);
    try {
      await accountService.enable2FA(token);
      setEnabled(true); setSetup(null); setToken("");
      toast.success("MFA enabled");
    } catch (e: any) { toast.error("Verification failed", { description: e.response?.data?.message || "Invalid code" }); }
    finally { setLoading(false); }
  };

  const handleDisable = async () => {
    if (!disablePwd) return toast.error("Current password required");
    setLoading(true);
    try {
      await accountService.disable2FA(disablePwd);
      setEnabled(false); setShowDisable(false); setDisablePwd("");
      toast.success("MFA disabled");
    } catch (e: any) { toast.error("MFA disable failed", { description: e.response?.data?.message }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="bg-white border border-slate-100 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {enabled
            ? <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            : <ShieldOff className="h-4 w-4 text-slate-300 shrink-0" />}
          <div>
            <p className="text-sm font-semibold text-slate-800">Multi-Factor Authentication</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
              <p className="text-xs text-slate-500">
                {enabled ? "Enabled — TOTP required at sign-in" : "Disabled — single-factor authentication only"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!enabled && !setup && (
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700" onClick={startSetup} disabled={loading}>
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Enable MFA
            </Button>
          )}
          {enabled && !showDisable && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => setShowDisable(true)}>
              Revoke MFA
            </Button>
          )}
        </div>
      </div>

      {/* Revoke confirmation */}
      {showDisable && (
        <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Revoke MFA</span>
            <span className="text-xs text-slate-400">Enter current password to confirm</span>
          </div>
          <div className="px-5 py-4 flex gap-2 items-center">
            <Input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)}
              placeholder="Current password" className="h-7 text-xs max-w-xs" />
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDisable} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Revoke"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400"
              onClick={() => { setShowDisable(false); setDisablePwd(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Setup flow */}
      {setup && !enabled && (
        <>
          {/* Step 1 — QR */}
          <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Step 1</span>
              <span className="text-sm font-semibold text-slate-800">Scan QR Code</span>
            </div>
            <div className="px-5 py-4 flex items-start gap-6">
              <div className="border border-slate-100 rounded p-2 bg-white shrink-0">
                <img src={setup.qrCode} alt="TOTP QR Code" className="w-36 h-36" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Open your authenticator app (Google Authenticator, Authy, 1Password) and scan the QR code, or enter the key manually.
                </p>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Manual entry key</p>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded">{setup.secret}</code>
                    <button onClick={() => copyText(setup.secret)} className="text-slate-400 hover:text-slate-700">
                      {copied === setup.secret ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — Verify */}
          <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Step 2</span>
              <span className="text-sm font-semibold text-slate-800">Verify TOTP Code</span>
            </div>
            <div className="px-5 py-4 flex items-center gap-3">
              <Input placeholder="6-digit code" value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6} className="h-7 text-xs w-32 font-mono tracking-widest text-center" />
              <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-800 hover:bg-slate-700"
                onClick={handleVerify} disabled={loading || token.length !== 6}>
                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                Verify & Activate
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={() => { setSetup(null); setToken(""); }}>
                Cancel
              </Button>
            </div>
          </div>

          {/* Step 3 — Recovery codes */}
          <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Step 3</span>
              <span className="text-sm font-semibold text-slate-800">Recovery Codes</span>
              <span className="text-xs text-slate-400 ml-1">Store offline — each code is single-use</span>
            </div>
            <div className="px-5 py-4 grid grid-cols-4 gap-1.5">
              {setup.backupCodes?.map((code, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded px-2.5 py-1.5 bg-slate-50">
                  <code className="text-[11px] font-mono text-slate-600">{code}</code>
                  <button onClick={() => copyText(code)} className="text-slate-400 hover:text-slate-700 ml-1">
                    {copied === code ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Audit trail section ──────────────────────────────────────────────────────

function AuditSection() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const d = await accountService.getActivityLogs(1, 20); setLogs(d.logs); }
      catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800">Audit Trail</span>
        {!loading && <span className="text-xs text-slate-400">{logs.length} events</span>}
      </div>

      {loading ? (
        <div className="divide-y divide-slate-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-6 animate-pulse">
              <div className="h-2.5 w-36 bg-slate-100 rounded" />
              <div className="h-2.5 w-20 bg-slate-100 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
              <div className="h-2.5 w-28 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-slate-400">
          <Activity className="h-6 w-6 mb-2 text-slate-200" />
          <p className="text-sm">No audit events recorded</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              {["Event", "Category", "Source IP", "Timestamp", "Result"].map((h) => (
                <th key={h} className="px-5 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => {
              const meta = ACT_TYPE[log.type] ?? { dot: "bg-slate-300", label: log.type };
              return (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-2.5">
                    <p className="text-[12px] font-medium text-slate-700">{log.action}</p>
                    {log.details && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">{log.details}</p>}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-[11px] text-slate-500">{log.ip || "—"}</td>
                  <td className="px-5 py-2.5 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{fmtTs(log.timestamp)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] ${log.success ? "text-emerald-600" : "text-red-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${log.success ? "bg-emerald-500" : "bg-red-400"}`} />
                      {log.success ? "Success" : "Failed"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const Account = () => {
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState<(UserProfile & { twoFactorEnabled: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const p = await accountService.getProfile();
      setProfile(p);
      // Restore saved language preference
      const lang = p.language || localStorage.getItem('waf-language') || 'en';
      if (lang !== i18n.language) {
        await i18n.changeLanguage(lang);
      }
    }
    catch { toast.error("Failed to load profile"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Account Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Profile, credentials, MFA, and audit trail</p>
        </div>
      </div>

      {/* Tab bar — underline style */}
      <div className="flex border-b border-slate-100 bg-white rounded-t-lg overflow-hidden -mb-px">
        {TAB_ITEMS.map(({ id, icon: Icon, label }) => {
          const active = section === id;
          return (
            <button key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                ${active
                  ? "border-slate-800 text-slate-800 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-3">
        {loading ? (
          <div className="bg-white border border-slate-100 rounded-lg px-5 py-12 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {section === "profile"  && profile && <ProfileSection profile={profile} onReload={loadProfile} />}
            {section === "security" && <CredentialSection />}
            {section === "mfa"      && profile && <MFASection     profile={profile} />}
            {section === "audit"    && <AuditSection />}
          </>
        )}
      </div>
    </div>
  );
};

export default Account;
