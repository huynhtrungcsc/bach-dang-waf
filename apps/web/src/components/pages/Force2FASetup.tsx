import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { accountService } from '@/services/auth.service';

interface Force2FASetupProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const o = {
  deepest:  '#0d3350',
  deep:     '#14466b',
  mid:      '#1a5580',
  border:   '#2470a0',
  gold:     '#c9a54a',
  goldHov:  '#b8922f',
  goldDim:  'rgba(201,165,74,0.1)',
  text:     '#eef6ff',
  muted:    'rgba(200,225,250,0.75)',
  input:    '#0d3350',
  inputBdr: '#2470a0',
};

const Header = () => (
  <header style={{ background: o.deepest, borderBottom: `2px solid ${o.gold}` }}>
    <div className="flex items-center justify-between px-6 h-14">
      <div className="flex items-center gap-3">
        <img src="/bach-dang-waf-logo.png" alt="BACH DANG WAF" className="h-7 w-auto" />
        <div>
          <span className="font-semibold text-sm tracking-wide" style={{ color: o.text }}>BACH DANG WAF</span>
        </div>
      </div>
      <span className="text-xs" style={{ color: o.muted }}>WAF Management Console</span>
    </div>
  </header>
);

const Footer = () => (
  <footer className="text-center py-3 text-[11px] shrink-0"
    style={{ background: o.deepest, color: 'rgba(180,210,240,0.2)', borderTop: `1px solid ${o.border}` }}>
    BACH DANG WAF &nbsp;·&nbsp; © 2025 0xDragon &nbsp;·&nbsp; All rights reserved
  </footer>
);

export default function Force2FASetup({ onComplete, onSkip }: Force2FASetupProps) {
  const [setup, setSetup] = useState<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null);
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkipDialog, setShowSkipDialog] = useState(false);

  useEffect(() => {
    (async () => {
      try { setSetup(await accountService.setup2FA()); }
      catch (e: any) { toast.error(e.response?.data?.message || 'Failed to setup 2FA'); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length !== 6) { toast.error('Enter a 6-digit code'); return; }
    setIsSubmitting(true);
    try {
      await accountService.enable2FA(token);
      toast.success('2FA enabled');
      onComplete();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Invalid code');
    } finally { setIsSubmitting(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen flex flex-col" style={{ background: o.deep }}>
      <Header />
      <div className="flex-1 flex items-center justify-center gap-3" style={{ color: o.muted }}>
        <span className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: o.border, borderTopColor: o.gold }} />
        <span className="text-sm">Initialising…</span>
      </div>
      <Footer />
    </div>
  );

  if (!setup) return (
    <div className="min-h-screen flex flex-col" style={{ background: o.deep }}>
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#f87171' }}>Failed to initialise 2FA. Contact your administrator.</p>
      </div>
      <Footer />
    </div>
  );

  return (
    <>
      {/* Skip dialog */}
      {showSkipDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-lg p-6 space-y-4" style={{ background: o.mid, border: `1px solid ${o.border}` }}>
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: o.gold }}>Security Warning</h2>
            <p className="text-sm" style={{ color: o.text }}>
              Skipping 2FA leaves your account with password-only protection. Unauthorised access risk increases significantly.
            </p>
            <p className="text-xs" style={{ color: o.muted }}>Are you sure you want to continue without 2FA?</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowSkipDialog(false)}
                className="flex-1 h-9 text-xs font-semibold rounded"
                style={{ background: o.gold, color: o.deepest, border: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = o.goldHov)}
                onMouseLeave={e => (e.currentTarget.style.background = o.gold)}>
                Back to setup
              </button>
              <button onClick={() => { setShowSkipDialog(false); toast.warning('2FA not enabled'); if (onSkip) onSkip(); }}
                className="flex-1 h-9 text-xs rounded"
                style={{ background: 'transparent', border: `1px solid ${o.border}`, color: o.muted }}
                onMouseEnter={e => (e.currentTarget.style.color = o.text)}
                onMouseLeave={e => (e.currentTarget.style.color = o.muted)}>
                Skip anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col" style={{ background: o.deep }}>
        <Header />

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-3xl">

            {/* Page title */}
            <div className="mb-6 text-center">
              <h1 className="text-lg font-bold tracking-wide" style={{ color: o.gold }}>
                TWO-FACTOR AUTHENTICATION SETUP
              </h1>
              <p className="text-xs mt-1" style={{ color: o.muted }}>
                Secure your account with a TOTP authenticator before accessing the console.
              </p>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-2 gap-10">

              {/* ── Left: QR + backup codes ── */}
              <div className="space-y-4">

                {/* QR code */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: o.text }}>Scan with authenticator app</p>
                  <p className="text-xs" style={{ color: o.muted }}>
                    Google Authenticator, Authy, Microsoft Authenticator or any TOTP-compatible app.
                  </p>
                  <div className="flex justify-center p-3 rounded" style={{ background: '#fff', border: `2px solid ${o.gold}` }}>
                    <img src={setup.qrCode} alt="2FA QR Code" className="w-40 h-40" />
                  </div>
                  <p className="text-[10px] text-center font-mono break-all" style={{ color: o.muted }}>
                    {setup.secret}
                  </p>
                </div>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${o.border}` }} />

                {/* Backup codes */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: o.text }}>Backup codes</p>
                  <p className="text-xs" style={{ color: o.muted }}>
                    Save these offline. Each code is single-use for emergency access.
                  </p>
                  <div className="rounded p-3 space-y-1" style={{ background: o.input, border: `1px solid ${o.inputBdr}` }}>
                    {setup.backupCodes.map((code, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="font-mono text-xs" style={{ color: o.text }}>{code}</span>
                        <button type="button"
                          onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied'); }}
                          className="text-[10px] transition-opacity"
                          style={{ color: o.gold }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Right: verify + skip ── */}
              <div className="flex flex-col justify-between">
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold" style={{ color: o.text }}>Verify &amp; activate</p>
                    <p className="text-xs" style={{ color: o.muted }}>
                      Open your authenticator app and enter the 6-digit code shown for this account.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={token}
                      onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoFocus
                      className="w-full h-14 rounded text-center text-2xl font-mono tracking-[0.5em] outline-none transition-colors"
                      style={{ background: o.input, border: `1px solid ${o.inputBdr}`, color: o.text, caretColor: o.gold }}
                      onFocus={e => (e.currentTarget.style.borderColor = o.gold)}
                      onBlur={e =>  (e.currentTarget.style.borderColor = o.inputBdr)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={token.length !== 6 || isSubmitting}
                    className="w-full h-10 text-sm font-semibold rounded flex items-center justify-center gap-2 transition-colors"
                    style={{
                      background: (token.length !== 6 || isSubmitting) ? o.goldHov : o.gold,
                      color: o.deepest,
                      opacity: token.length !== 6 ? 0.5 : 1,
                      cursor: (token.length !== 6 || isSubmitting) ? 'not-allowed' : 'pointer',
                      border: 'none',
                    }}
                    onMouseEnter={e => { if (token.length === 6 && !isSubmitting) e.currentTarget.style.background = o.goldHov; }}
                    onMouseLeave={e => { if (token.length === 6 && !isSubmitting) e.currentTarget.style.background = o.gold; }}>
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 rounded-full animate-spin"
                          style={{ borderColor: `${o.deepest}40`, borderTopColor: o.deepest }} />
                        Verifying…
                      </>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" /> Verify &amp; Enable 2FA</>
                    )}
                  </button>

                  {/* Info note */}
                  <p className="text-[11px]" style={{ color: o.muted }}>
                    Once verified, 2FA will be active on your account immediately. Keep your backup codes in a secure, offline location.
                  </p>
                </form>

                {/* Skip */}
                {onSkip && (
                  <div className="pt-4" style={{ borderTop: `1px solid ${o.border}` }}>
                    <button
                      type="button"
                      onClick={() => setShowSkipDialog(true)}
                      className="w-full h-9 text-xs rounded transition-colors"
                      style={{ background: 'transparent', border: `1px solid ${o.border}`, color: o.muted }}
                      onMouseEnter={e => (e.currentTarget.style.color = o.text)}
                      onMouseLeave={e => (e.currentTarget.style.color = o.muted)}>
                      Skip for now (not recommended)
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
