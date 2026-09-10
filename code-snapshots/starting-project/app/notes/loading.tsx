export default function NotesLoading() {
  return (
    <main className="flex-1 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div aria-busy="true" aria-label="Loading notes" className="mx-auto max-w-6xl animate-pulse">
        <div className="h-4 w-28 rounded bg-teal-100" />
        <div className="mt-4 h-10 w-56 rounded bg-slate-200" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 rounded-2xl border border-teal-100 bg-white" />
          ))}
        </div>
      </div>
    </main>
  );
}
