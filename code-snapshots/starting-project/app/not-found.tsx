import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-teal-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-teal-700">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This page doesn’t exist or isn’t available to your account.
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-flex rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600"
        >
          Back to my notes
        </Link>
      </section>
    </main>
  );
}
