"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { login } from "@/components/auth";

const GOOGLE_ERROR_MAP: Record<string, string> = {
  google_auth_failed: "Google sign-in was cancelled or denied.",
  google_state_invalid: "Authentication session expired. Please try again.",
  google_token_failed: "Failed to exchange token with Google.",
  google_profile_failed: "Failed to load Google profile information.",
  google_email_missing: "Could not retrieve email address from your Google account.",
  google_not_configured: "Google OAuth is not configured on this server.",
  google_internal_error: "An unexpected error occurred during Google sign-in.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return "";
    return GOOGLE_ERROR_MAP[errorParam] || "Authentication failed. Please try again.";
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-5 rounded-xl border border-red-200/80 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/40 p-3.5 text-sm text-red-700 dark:text-red-300 backdrop-blur-md animate-fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <div className="flex items-center gap-3 rounded-[1rem] border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/40 px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary)/0.4)] backdrop-blur-md shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] transition-all group">
            <Mail size={17} className="text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--primary))] transition-colors" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              placeholder="you@example.com"
            />
          </div>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[hsl(var(--primary))] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="flex items-center gap-3 rounded-[1rem] border border-white/30 dark:border-white/10 bg-white/40 dark:bg-black/40 px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary)/0.4)] backdrop-blur-md shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] transition-all group">
            <Lock size={17} className="text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--primary))] transition-colors" />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              placeholder="Password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[1rem] bg-[hsl(var(--primary))] text-sm font-semibold text-white shadow-[0_8px_16px_-6px_hsl(var(--primary)/0.5)] transition-all hover-lift active-press hover:bg-[hsl(var(--primary)/0.92)] hover:shadow-[0_12px_20px_-6px_hsl(var(--primary)/0.6)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover-lift-none disabled:active-press-none"
        >
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))] relative overflow-hidden">
      {/* Background Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/15 blur-[100px] pointer-events-none" />

      <div className="grid min-h-dvh lg:grid-cols-[1fr_440px] relative z-10">
        <section className="hidden lg:flex flex-col justify-between border-r border-white/10 dark:border-white/[0.05] bg-white/10 dark:bg-black/10 backdrop-blur-2xl p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold">Kaori AI</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Private workspace assistant</div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
              Welcome back
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight">
              Continue your conversations without losing context.
            </h1>
            <p className="mt-5 text-base leading-7 text-[hsl(var(--muted-foreground))]">
              Your chats, connected tools, and model preferences stay protected behind your account.
            </p>
          </div>

          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            Encrypted conversation storage and session-based access.
          </div>
        </section>

        <section className="flex items-center justify-center px-4 sm:px-5 py-10 relative">
          {/* Glass overlay for the right section */}
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.08)] to-transparent pointer-events-none" />
          <div className="w-full max-w-sm animate-fade-in glass-panel p-6 sm:p-10 rounded-3xl shadow-2xl z-10 border border-white/40 dark:border-white/10 bg-white/30 dark:bg-neutral-900/40 backdrop-blur-[24px]">
            <div className="mb-6 sm:mb-8 lg:hidden">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-sm">
                <Sparkles size={22} />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Sign in to Kaori</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Pick up where you left off.
              </p>
            </div>

            <div className="mb-8 hidden lg:block">
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Use your account credentials to continue.
              </p>
            </div>

            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/10" />}>
              <LoginForm />
            </Suspense>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-black/15 to-black/10 dark:via-white/15 dark:to-white/10" />
              <span className="rounded-full border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/[0.06] px-3 py-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                or
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-black/15 to-black/10 dark:via-white/15 dark:to-white/10" />
            </div>

            <a
              href="/api/auth/google"
              className="group relative flex h-11 w-full items-center justify-center gap-2.5 rounded-[1rem] border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 text-sm font-medium text-neutral-800 dark:text-neutral-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] backdrop-blur-md transition-all hover-lift active-press hover:bg-white/95 dark:hover:bg-white/[0.12] hover:border-white/60 dark:hover:border-white/20"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>

            <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              New to Kaori?{" "}
              <Link href="/signup" className="font-medium text-[hsl(var(--primary))] hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
