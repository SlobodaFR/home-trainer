import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';

const LINKS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/exercises', label: 'Exercices', end: false },
  { to: '/history', label: 'Historique', end: false },
];

export function NavBar() {
  const { user } = useAuth();

  return (
    <nav
      aria-label="Navigation principale"
      className="flex items-center gap-6 px-4 py-3 bg-canvas border-b border-hairline"
    >
      {LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive
              ? 'text-ink font-medium underline text-sm'
              : 'text-mute text-sm'
          }
        >
          {label}
        </NavLink>
      ))}

      {user && (
        <div className="ml-auto flex items-center gap-2">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-soft-cloud border border-hairline flex items-center justify-center text-xs font-medium text-ink"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-ink">{user.name}</span>
        </div>
      )}
    </nav>
  );
}
