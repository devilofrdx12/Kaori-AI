"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { login } from "@/components/auth";
import { GrainFlowBackground } from "@/components/grain-flow-background";

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
        <div className="mb-5 rounded-2xl border border-red-200/80 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/40 p-3.5 text-sm text-red-700 dark:text-red-300 backdrop-blur-md animate-fade-in">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Email
          </span>
          <div className="flex h-11 sm:h-12 items-center gap-3 rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] px-3.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all focus-within:border-[#ec4899]/50 focus-within:ring-2 focus-within:ring-[#ec4899]/25 group">
            <Mail size={18} className="text-neutral-400 dark:text-neutral-500 group-focus-within:text-[#ec4899] transition-colors shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-full w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder="you@example.com"
            />
          </div>
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#ec4899] hover:text-[#db2777] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="flex h-11 sm:h-12 items-center gap-3 rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/[0.04] px-3.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all focus-within:border-[#ec4899]/50 focus-within:ring-2 focus-within:ring-[#ec4899]/25 group">
            <Lock size={18} className="text-neutral-400 dark:text-neutral-500 group-focus-within:text-[#ec4899] transition-colors shrink-0" />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="h-full w-full bg-transparent text-sm text-neutral-900 dark:text-neutral-100 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder="Password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="group relative flex h-11 sm:h-12 w-full items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-[#e83b86] text-sm font-semibold text-white shadow-[0_8px_20px_-4px_rgba(232,59,134,0.45)] transition-all hover:bg-[#db2777] hover:shadow-[0_12px_24px_-4px_rgba(232,59,134,0.55)] hover-lift active-press disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh relative overflow-x-hidden overflow-y-auto select-none bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Interactive WebGL Grain Flow fluid theme background with chromatic aberration text */}
      <GrainFlowBackground />

      {/* Accessible semantic copy for screen readers and SEO */}
      <div className="sr-only">
        <h1>Kaori AI — Private workspace assistant</h1>
        <p>Welcome back. Continue your conversations without losing context.</p>
        <p>Your chats, connected tools, and model preferences stay protected behind your account.</p>
        <p>Encrypted conversation storage and session-based access.</p>
      </div>

      {/* Two-column grid matching Signup page (lg:grid-cols-[1fr_460px]) */}
      <div className="grid min-h-dvh lg:grid-cols-[1fr_460px] relative z-10 pointer-events-none">
        {/* Left column is transparent so the WebGL fluid wave & text shines through, with exact border matching signup */}
        <div className="hidden lg:block border-r border-[hsl(var(--border))] pointer-events-none" />

        {/* Right column centering the floating card with theme overlay, responsive padding matching signup */}
        <section className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-5 lg:py-10 relative pointer-events-none">
          {/* Subtle warm pink ambient glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#ec4899]/[0.06] to-transparent pointer-events-none" />

          <div className="w-full max-w-sm pointer-events-auto rounded-3xl sm:rounded-[2.25rem] p-6 sm:p-8 lg:p-10 border border-white/50 dark:border-white/10 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.08),0_12px_24px_-8px_rgba(0,0,0,0.04)] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] z-10 transition-all duration-300 animate-fade-in animate-[floatY_6s_ease-in-out_infinite] hover:[animation-play-state:paused] relative select-auto transform-gpu will-change-transform">
            {/* Mobile Header with brand badge (matching signup page) */}
            <div className="mb-6 sm:mb-8 lg:hidden">
              <div className="mb-4 sm:mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[#e83b86] text-white shadow-[0_8px_20px_-4px_rgba(232,59,134,0.45)]">
                <Sparkles size={22} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Sign in
              </h1>
              <p className="mt-1.5 sm:mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                Use your account credentials to continue.
              </p>
            </div>

            {/* Desktop Header matching signup page */}
            <div className="mb-7 hidden lg:block">
              <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-neutral-900 dark:text-white">
                Sign in
              </h1>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400 font-normal">
                Use your account credentials to continue.
              </p>
            </div>

            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/10" />}>
              <LoginForm />
            </Suspense>

            <div className="relative my-5 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200/80 dark:border-neutral-800/80" />
              </div>
              <span className="relative z-10 rounded-full bg-white/80 dark:bg-neutral-900/80 px-3 py-0.5 text-xs font-medium text-neutral-400 dark:text-neutral-500 border border-white/60 dark:border-white/10 shadow-sm backdrop-blur-md">
                or
              </span>
            </div>

            <a
              href="/api/auth/google"
              className="group relative flex h-11 sm:h-12 w-full items-center justify-center gap-2.5 rounded-xl sm:rounded-2xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/[0.08] px-4 text-sm font-semibold text-neutral-800 dark:text-neutral-100 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 dark:hover:bg-white/15 hover-lift active-press"
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

            <p className="mt-6 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">
              New to Kaori?{" "}
              <Link href="/signup" className="font-semibold text-[#ec4899] hover:text-[#db2777] hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}


