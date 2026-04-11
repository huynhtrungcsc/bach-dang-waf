import { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';
import { useAuthStorage } from '@/hooks/useAuthStorage';

interface ForcePasswordChangeProps {
  userId: string;
  tempToken: string;
  onPasswordChanged: (require2FASetup: boolean) => void;
}

const ocean = {
  deepest:  '#0d3350',
  deep:     '#14466b',
  mid:      '#1a5580',
  border:   '#2470a0',
  gold:     '#c9a54a',
  goldHov:  '#b8922f',
  goldDim:  'rgba(201,165,74,0.12)',
  text:     '#eef6ff',
  muted:    'rgba(200,225,250,0.75)',
  input:    '#0d3350',
  inputBdr: '#2470a0',
  inputFoc: '#c9a54a',
};

export default function ForcePasswordChange({ userId, tempToken, onPasswordChanged }: ForcePasswordChangeProps) {
  const { setAuth } = useAuthStorage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinLength   = newPassword.length >= 8;
  const hasUpperCase   = /[A-Z]/.test(newPassword);
  const hasLowerCase   = /[a-z]/.test(newPassword);
  const hasNumber      = /\d/.test(newPassword);
  const hasSpecialChar = /[@$!%*?&]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) { toast.error('Password does not meet security requirements'); return; }
    if (!passwordsMatch)  { toast.error('Passwords do not match'); return; }
    setIsSubmitting(true);
    try {
      const result = await authService.changePasswordFirstLogin({ userId, tempToken, newPassword });
      setAuth(result.user, result.accessToken, result.refreshToken);
      toast.success('Password changed successfully');
      onPasswordChanged(result.require2FASetup);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const req = (met: boolean, label: string) => (
    <div className="flex items-center gap-2 text-xs" style={{ color: met ? '#4ade80' : ocean.muted }}>
      {met
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#4ade80' }} />
        : <XCircle     className="h-3.5 w-3.5 shrink-0" style={{ color: ocean.muted }} />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ocean.deep }}>

      {/* ── Header ── */}
      <header style={{ background: ocean.deepest, borderBottom: `2px solid ${ocean.gold}` }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <img src="/bach-dang-waf-logo.png" alt="BACH DANG WAF" className="h-7 w-auto" />
            <div>
              <span className="font-semibold text-sm tracking-wide" style={{ color: ocean.text }}>
                BACH DANG WAF
              </span>
            </div>
          </div>
          <span className="text-xs" style={{ color: ocean.muted }}>
            WAF Management Console
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          <h1
            className="text-center text-xl font-bold mb-5"
            style={{ color: ocean.gold, letterSpacing: '0.02em' }}
          >
            PASSWORD CHANGE REQUIRED
          </h1>

          <div className="px-1">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Security notice */}
              <p className="text-xs" style={{ color: ocean.muted }}>
                Your password must be changed before you can access the console.
              </p>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: ocean.muted }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    autoFocus
                    className="w-full h-10 px-3 pr-10 text-sm rounded outline-none transition-colors"
                    style={{ background: ocean.input, border: `1px solid ${ocean.inputBdr}`, color: ocean.text, caretColor: ocean.gold }}
                    onFocus={e => (e.currentTarget.style.borderColor = ocean.inputFoc)}
                    onBlur={e =>  (e.currentTarget.style.borderColor = ocean.inputBdr)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: ocean.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = ocean.gold)}
                    onMouseLeave={e => (e.currentTarget.style.color = ocean.muted)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest" style={{ color: ocean.muted }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full h-10 px-3 pr-10 text-sm rounded outline-none transition-colors"
                    style={{ background: ocean.input, border: `1px solid ${ocean.inputBdr}`, color: ocean.text, caretColor: ocean.gold }}
                    onFocus={e => (e.currentTarget.style.borderColor = ocean.inputFoc)}
                    onBlur={e =>  (e.currentTarget.style.borderColor = ocean.inputBdr)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: ocean.muted }}
                    onMouseEnter={e => (e.currentTarget.style.color = ocean.gold)}
                    onMouseLeave={e => (e.currentTarget.style.color = ocean.muted)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Requirements */}
              <div className="space-y-1.5 pt-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ocean.muted }}>
                  Requirements
                </p>
                <div className="space-y-1">
                  {req(hasMinLength,   'At least 8 characters')}
                  {req(hasUpperCase,   'Uppercase letter (A–Z)')}
                  {req(hasLowerCase,   'Lowercase letter (a–z)')}
                  {req(hasNumber,      'Number (0–9)')}
                  {req(hasSpecialChar, 'Special character (@$!%*?&)')}
                  {confirmPassword && req(passwordsMatch, 'Passwords match')}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
                  className="w-full h-10 text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
                  style={{
                    background: (!isPasswordValid || !passwordsMatch || isSubmitting) ? ocean.goldHov : ocean.gold,
                    color: ocean.deepest,
                    cursor: (!isPasswordValid || !passwordsMatch || isSubmitting) ? 'not-allowed' : 'pointer',
                    opacity: (!isPasswordValid || !passwordsMatch) ? 0.5 : 1,
                    border: 'none',
                  }}
                  onMouseEnter={e => { if (isPasswordValid && passwordsMatch && !isSubmitting) e.currentTarget.style.background = ocean.goldHov; }}
                  onMouseLeave={e => { if (isPasswordValid && passwordsMatch && !isSubmitting) e.currentTarget.style.background = ocean.gold; }}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${ocean.deepest}40`, borderTopColor: ocean.deepest }} />
                      Saving...
                    </>
                  ) : 'Change Password & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="text-center py-3 text-[11px]"
        style={{ background: ocean.deepest, color: 'rgba(180,210,240,0.2)', borderTop: `1px solid ${ocean.border}` }}
      >
        BACH DANG WAF &nbsp;·&nbsp; © 2025 0xDragon &nbsp;·&nbsp; All rights reserved
      </footer>
    </div>
  );
}
