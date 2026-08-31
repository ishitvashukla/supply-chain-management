import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { session, tokens } from '@/api/tokens';
import { TURNS_ROLES, checkBusinessId, type TurnsRole } from '@/api/turnsAuth';
import { useAuth } from '@/hooks/useAuth';
import { BrandLockup, BrandMark } from '@/components/BrandMark';
import { Button, Card, Field, Input, SelectMenu } from '@/components/ui';
import { Icons } from '@/components/icons';

type Step = 'business' | 'credentials';

const roleHint: Record<TurnsRole, string> = {
  ADMIN: 'Your admin username',
  EMPLOYEE: 'Your work email address',
  STORE: 'Your store login',
};

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Turns is multi-tenant, so the business has to be known before we can even
  // build the API base URL — that is why this is a step of its own.
  const [step, setStep] = useState<Step>(session.businessId() ? 'credentials' : 'business');
  const [businessId, setBusinessId] = useState(session.businessId() ?? '');
  const [role, setRole] = useState<TurnsRole>('STORE');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const submitBusiness = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const valid = await checkBusinessId(businessId);
      if (!valid) {
        setError('We could not find that business. Check the id and try again.');
        return;
      }
      session.setBusinessId(businessId.trim());
      setStep('credentials');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(role, username, password);
      navigate(from, { replace: true });
    } catch (err) {
      if ((err as { requires2FA?: boolean })?.requires2FA) {
        setError('This account requires two-factor verification, which is not enabled here yet.');
        return;
      }
      setError(err instanceof ApiError ? err.message : (err as Error)?.message ?? 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const changeBusiness = () => {
    tokens.clearAll();
    session.clearBusinessId();
    setBusinessId('');
    setStep('business');
    setError(null);
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — desktop only, so phones go straight to the form. */}
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15">
            <BrandMark className="size-6" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">SupplyHub</span>
        </div>
        <div className="space-y-4">
          <p className="text-3xl font-bold leading-tight">
            One catalog. Every location. Full control of stock, orders and spend.
          </p>
          <p className="text-primary-foreground/80">
            Stores raise their own orders, head office approves and tracks payment — all against a
            shared product catalog with per-location pricing.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">Supply Management Suite</p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <BrandLockup className="lg:hidden" />
          </div>

          {step === 'business' ? (
            <>
              <div className="mb-6 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Find your business</h1>
                <p className="text-sm text-muted-foreground">
                  Enter the business id you use to sign in.
                </p>
              </div>

              <Card className="p-5">
                <form onSubmit={submitBusiness} className="space-y-4">
                  <Field label="Business id" htmlFor="businessId" required>
                    <Input
                      id="businessId"
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      icon={<Icons.business />}
                      placeholder="acme"
                      value={businessId}
                      onChange={(e) => setBusinessId(e.target.value)}
                    />
                  </Field>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" full size="lg" loading={loading}>
                    Continue
                  </Button>
                </form>
              </Card>
            </>
          ) : (
            <>
              <div className="mb-6 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome back. Enter your details to continue.
                </p>
              </div>

              <Card className="p-5">
                <form onSubmit={submitCredentials} className="space-y-4">
                  <Field label="Login as" htmlFor="role">
                    <SelectMenu
                      id="role"
                      value={role}
                      onChange={setRole}
                      options={TURNS_ROLES}
                      aria-label="Login as"
                    />
                  </Field>

                  <Field label={role === 'EMPLOYEE' ? 'Email address' : 'Username'} htmlFor="username" required>
                    <Input
                      id="username"
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                      type={role === 'EMPLOYEE' ? 'email' : 'text'}
                      autoComplete="username"
                      required
                      icon={<Icons.user />}
                      placeholder={roleHint[role]}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </Field>

                  <Field label="Password" htmlFor="password" required>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      icon={<Icons.lock />}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" full size="lg" loading={loading}>
                    Sign in
                  </Button>
                </form>
              </Card>

              <button
                onClick={changeBusiness}
                className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Icons.back className="size-3" />
                Signing in to <span className="font-medium text-foreground">{businessId}</span> —
                change
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
