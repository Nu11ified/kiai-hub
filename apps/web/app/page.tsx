export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold tracking-tight">Kiai Hub</h1>
      <p className="mt-4 text-lg text-gray-600">
        Kendo event management for dojos worldwide.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/auth/signin"
          className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sign In
        </a>
        <a
          href="/events"
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium hover:bg-gray-50"
        >
          Browse Events
        </a>
      </div>
    </main>
  );
}
