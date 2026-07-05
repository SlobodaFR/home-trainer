export function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 text-center">
          Trainer
        </h1>
        <a
          href="/api/auth/login"
          className="bg-gray-900 text-white px-8 py-3 rounded-full font-medium text-center hover:bg-gray-700 transition-colors"
        >
          Se connecter
        </a>
      </div>
    </main>
  );
}
