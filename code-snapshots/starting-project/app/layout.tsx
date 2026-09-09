import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import SignOutButton from "@/app/components/sign-out-button";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TinyNotes",
    template: "%s | TinyNotes",
  },
  description: "Write, organize, and share notes without the clutter.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-950 antialiased">
        <header className="border-b border-teal-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950"
            >
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white shadow-sm"
              >
                T
              </span>
              TinyNotes
            </Link>

            <nav aria-label="Primary navigation" className="flex items-center gap-2 sm:gap-4">
              {session ? (
                <>
                  <Link
                    href="/notes"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-teal-800"
                  >
                    My notes
                  </Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                  >
                    Get started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
