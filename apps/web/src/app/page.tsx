export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Koho volím</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Next.js, Tailwind, Turborepo and Kysely. Database status is at{" "}
        <a className="underline underline-offset-4" href="/api/health">
          /api/health
        </a>
        .
      </p>
    </main>
  );
}
