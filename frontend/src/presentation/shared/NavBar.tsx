import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/exercises', label: 'Exercices', end: false },
  { to: '/history', label: 'Historique', end: false },
];

export function NavBar() {
  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-6 px-4 py-3 bg-canvas border-b border-hairline"
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
    </nav>
  );
}
