import { useSearchParams } from 'react-router-dom';

/**
 * Public landing after a service-initiated logout (PC10): never starts /authorize by itself,
 * the user logs in again by choice.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const loggedOut = searchParams.get('logged_out') === '1';

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 text-center">
          Trainer
        </h1>
        {loggedOut && (
          <p role="status" className="text-gray-500 text-center">
            Vous avez été déconnecté.
          </p>
        )}
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
