"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const [error, setError] = useState("");
  const isRegister = mode === "register";
  const title = isRegister ? "Create your account" : "Welcome back";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Connect to authentication when the server integration is added.
    // Never allow the browser to submit credentials in a URL.
    setError("Authentication is not available yet. Please try again later.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"
      >
        <p className="mb-6 text-sm font-semibold tracking-wide text-teal-300">TinyNotes</p>
        <h1 id="auth-title" className="text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isRegister ? "A little space for your ideas." : "Log in to return to your notes."}
        </p>

        <form method="post" onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-base outline-none focus-visible:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : undefined}
              required
              aria-describedby={isRegister ? "password-hint" : undefined}
              className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-base outline-none focus-visible:border-teal-300 focus-visible:ring-2 focus-visible:ring-teal-300"
            />
            {isRegister && (
              <p id="password-hint" className="mt-2 text-sm text-slate-400">
                Use at least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-300 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
          >
            {isRegister ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="rounded font-medium text-teal-300 underline underline-offset-4 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
          >
            {isRegister ? "Log in" : "Register"}
          </Link>
        </p>
      </section>
    </main>
  );
}
