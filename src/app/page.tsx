export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight">Overhead</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        The view from above your AWS architecture — and what it costs to run.
      </p>
      <p className="max-w-md font-mono text-sm text-zinc-500">
        Phase 0: ask your agent to call <code>overhead_ping</code> from this
        page&apos;s site tools.
      </p>
    </main>
  );
}
