export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <a href="/" className="text-xl font-bold">Kiai Hub</a>
          <nav className="flex gap-4">
            <a href="/events" className="text-sm text-gray-600 hover:text-gray-900">Events</a>
            <a href="/signin" className="text-sm text-gray-600 hover:text-gray-900">Sign In</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
