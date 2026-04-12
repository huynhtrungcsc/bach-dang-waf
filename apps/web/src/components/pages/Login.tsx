import { useState } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/auth';
import { toast } from 'sonner';
import { Route } from '@/routes/login';
import ForcePasswordChange from './ForcePasswordChange';
import Force2FASetup from './Force2FASetup';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandLogo';

type LoginStep = 'login' | 'passwordChange' | '2faSetup' | '2faVerify';

export default function Login() {
  const router = useRouter();
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const { login, loginWith2FA, isLoading: authLoading } = useAuth();
  const navigate = Route.useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<LoginStep>('login');
  const [userId, setUserId] = useState('');
  const [tempToken, setTempToken] = useState('');

  const search = Route.useSearch();
  const isLoggingIn = isLoading || isSubmitting || authLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (currentStep === '2faVerify' && userId) {
        await loginWith2FA(userId, twoFactor);
        toast.success('Authenticated');
        await router.invalidate();
        await new Promise(r => setTimeout(r, 100));
        await navigate({ to: search.redirect || '/dashboard' });
      } else {
        const response = await login(username, password);
        if (response.requirePasswordChange && response.tempToken) {
          setUserId(response.userId || '');
          setTempToken(response.tempToken);
          setCurrentStep('passwordChange');
        } else if (response.requires2FA) {
          setUserId(response.user.id);
          setCurrentStep('2faVerify');
        } else {
          toast.success('Signed in');
          await router.invalidate();
          await new Promise(r => setTimeout(r, 100));
          await navigate({ to: search.redirect || '/dashboard' });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChanged = (require2FASetup: boolean) => {
    setCurrentStep(require2FASetup ? '2faSetup' : '2faVerify');
  };

  const handle2FASetupComplete = async () => {
    await router.invalidate();
    await new Promise(r => setTimeout(r, 500));
    await navigate({ to: search.redirect || '/dashboard' });
  };

  const handle2FASkip = async () => {
    await router.invalidate();
    await new Promise(r => setTimeout(r, 500));
    await navigate({ to: search.redirect || '/dashboard' });
  };

  if (currentStep === 'passwordChange') {
    return <ForcePasswordChange userId={userId} tempToken={tempToken} onPasswordChanged={handlePasswordChanged} />;
  }
  if (currentStep === '2faSetup') {
    return <Force2FASetup onComplete={handle2FASetupComplete} onSkip={handle2FASkip} />;
  }

  const is2FA = currentStep === '2faVerify';

  // Ocean blue palette — lighter, brighter ocean blue
  const ocean = {
    deepest:  '#0d3350',   // header & footer — dark ocean blue
    deep:     '#14466b',   // body background — medium ocean blue
    mid:      '#1a5580',   // card bg — slightly lighter blue
    border:   '#2470a0',   // card border — visible blue
    gold:     '#c9a54a',   // golden accent — cọc Bạch Đằng
    goldHov:  '#b8922f',
    goldDim:  'rgba(201,165,74,0.15)',
    text:     '#eef6ff',   // main text — near white-blue, high contrast
    muted:    'rgba(200,225,250,0.75)',   // labels — much more visible
    input:    '#0d3350',   // input bg
    inputBdr: '#2470a0',
    inputFoc: '#c9a54a',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: ocean.deep }}>

      {/* ── Header ── */}
      <header style={{ background: ocean.deepest, borderBottom: `2px solid ${ocean.gold}` }}>
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-3">
            <BrandMark size={28} variant="light" />
            <div>
              <span className="font-semibold text-sm tracking-wide" style={{ color: ocean.text }}>
                BACH DANG WAF
              </span>
            </div>
          </div>
          <span className="text-xs" style={{ color: 'rgba(180,210,240,0.35)' }}>
            WAF Management Console
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Label above card */}
          <p
            className="text-center text-[11px] font-semibold tracking-[0.22em] uppercase mb-5"
            style={{ color: ocean.muted }}
          >
            {is2FA ? 'Two-Factor Verification' : 'Administrator Authentication'}
          </p>

          {/* Form — no card, bare like pfSense */}
          <div className="px-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!is2FA && (
                <>
                  <div className="space-y-1.5">
                    <label
                      className="block text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: ocean.muted }}
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="admin"
                      required
                      autoFocus
                      className="w-full h-10 px-3 text-sm rounded outline-none transition-colors"
                      style={{
                        background: ocean.input,
                        border: `1px solid ${ocean.inputBdr}`,
                        color: ocean.text,
                        caretColor: ocean.gold,
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = ocean.inputFoc)}
                      onBlur={e => (e.currentTarget.style.borderColor = ocean.inputBdr)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="block text-[11px] font-semibold uppercase tracking-widest"
                      style={{ color: ocean.muted }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full h-10 px-3 pr-10 text-sm rounded outline-none transition-colors"
                        style={{
                          background: ocean.input,
                          border: `1px solid ${ocean.inputBdr}`,
                          color: ocean.text,
                          caretColor: ocean.gold,
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = ocean.inputFoc)}
                        onBlur={e => (e.currentTarget.style.borderColor = ocean.inputBdr)}
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
                </>
              )}

              {is2FA && (
                <div className="space-y-1.5">
                  <label
                    className="block text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: ocean.muted }}
                  >
                    Auth Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactor}
                    onChange={e => setTwoFactor(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    required
                    className="w-full h-14 px-3 rounded text-center text-2xl font-mono tracking-[0.5em] outline-none transition-colors"
                    style={{
                      background: ocean.input,
                      border: `1px solid ${ocean.inputBdr}`,
                      color: ocean.text,
                      caretColor: ocean.gold,
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = ocean.inputFoc)}
                    onBlur={e => (e.currentTarget.style.borderColor = ocean.inputBdr)}
                  />
                </div>
              )}

              <div className="pt-1 space-y-2">
                <button
                  type="submit"
                  disabled={isLoggingIn || (is2FA && twoFactor.length !== 6)}
                  className="w-full h-10 text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
                  style={{
                    background: isLoggingIn ? ocean.goldHov : ocean.gold,
                    color: ocean.deepest,
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    border: 'none',
                  }}
                  onMouseEnter={e => { if (!isLoggingIn) e.currentTarget.style.background = ocean.goldHov; }}
                  onMouseLeave={e => { if (!isLoggingIn) e.currentTarget.style.background = ocean.gold; }}
                >
                  {isLoggingIn ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 rounded-full animate-spin"
                        style={{ borderColor: `${ocean.deepest}40`, borderTopColor: ocean.deepest }}
                      />
                      Verifying...
                    </>
                  ) : (
                    is2FA ? 'Verify' : 'Sign In'
                  )}
                </button>

                {is2FA && (
                  <button
                    type="button"
                    onClick={() => { setCurrentStep('login'); setUserId(''); setTwoFactor(''); }}
                    className="w-full h-9 text-xs rounded transition-colors"
                    style={{
                      color: ocean.muted,
                      border: `1px solid ${ocean.border}`,
                      background: 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = ocean.text)}
                    onMouseLeave={e => (e.currentTarget.style.color = ocean.muted)}
                  >
                    ← Back to login
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="text-center py-3 text-[11px]"
        style={{
          background: ocean.deepest,
          color: 'rgba(180,210,240,0.25)',
          borderTop: `1px solid ${ocean.border}`,
        }}
      >
        BACH DANG WAF &nbsp;·&nbsp; © 2026 0xDragon &nbsp;·&nbsp; All rights reserved
      </footer>
    </div>
  );
}
