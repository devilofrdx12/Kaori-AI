"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Lock, Mail, Sparkles } from "lucide-react";
import { login } from "@/components/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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
    <main className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="grid min-h-screen lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:flex flex-col justify-between border-r border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] p-10">
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

        <section className="flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm animate-fade-in">
            <div className="mb-8 lg:hidden">
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

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
                  <Lock size={17} className="text-[hsl(var(--muted-foreground))]" />
                  <input
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
              </label>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs font-medium text-[hsl(var(--primary))] hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary)/0.92)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

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
