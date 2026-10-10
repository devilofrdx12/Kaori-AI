"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Sparkles, User } from "lucide-react";
import { signup } from "@/components/auth";

const GOOGLE_SIGNUP_ERROR_MAP: Record<string, string> = {
  google_auth_failed: "Google sign-up was cancelled or denied.",
  google_state_invalid: "Authentication session expired. Please try again.",
  google_token_failed: "Failed to exchange token with Google.",
  google_profile_failed: "Failed to load Google profile information.",
  google_email_missing: "Could not retrieve email address from your Google account.",
  google_not_configured: "Google OAuth is not configured on this server.",
  google_internal_error: "An unexpected error occurred during Google sign-up.",
};

function SignupForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return "";
    return GOOGLE_SIGNUP_ERROR_MAP[errorParam] || "Authentication failed. Please try again.";
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signup(name, email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary)/0.25)]">
            <User size={17} className="text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              placeholder="Your name"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary)/0.25)]">
            <Mail size={17} className="text-[hsl(var(--muted-foreground))]" />
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 focus-within:ring-2 focus-within:ring-[hsl(var(--primary)/0.25)]">
            <Lock size={17} className="text-[hsl(var(--muted-foreground))] group-focus-within:text-[hsl(var(--primary))] transition-colors" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]"
              placeholder="At least 8 characters"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary)/0.92)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
          {!loading && <ArrowRight size={16} />}
        </button>
      </form>
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="min-h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="grid min-h-dvh lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:flex flex-col justify-between border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold">Kaori AI</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Personal AI command center</div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
              Create your workspace
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight">
              A calmer place for chats, tools, and thinking.
            </h1>
            <p className="mt-5 text-base leading-7 text-[hsl(var(--muted-foreground))]">
              Set up a private account with encrypted conversations, model choice, and connected workflows.
            </p>
          </div>

          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            Passwords are hashed before storage.
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 relative">
          {/* Glass overlay for the right section */}
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-transparent pointer-events-none" />
          <div className="w-full max-w-sm animate-fade-in glass-panel p-8 sm:p-10 rounded-3xl shadow-xl z-10">
            <div className="mb-8 lg:hidden">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-sm">
                <Sparkles size={22} />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Start your Kaori workspace.
              </p>
            </div>

            <div className="mb-8 hidden lg:block">
              <h2 className="text-2xl font-semibold tracking-tight">Create account</h2>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                Your workspace will be ready in a moment.
              </p>
            </div>

            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white/10" />}>
              <SignupForm />
            </Suspense>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-[hsl(var(--border))]" />
              <span className="relative rounded-full bg-[hsl(var(--card))] px-2.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
                or
              </span>
            </div>

            <a
              href="/api/auth/google"
              className="group relative flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 text-sm font-medium text-neutral-800 dark:text-neutral-100 shadow-sm transition-all hover-lift active-press hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
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
              <span>Sign up with Google</span>
            </a>

            <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-[hsl(var(--primary))] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
