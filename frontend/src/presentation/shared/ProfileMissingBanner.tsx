import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfile } from '../../infrastructure/profile-client';

export function ProfileMissingBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void getProfile().then((profile) => {
      if (!profile) setShow(true);
    });
  }, []);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 px-4 py-3 bg-soft-cloud border border-hairline rounded-lg"
    >
      <p className="text-sm text-ink">
        Complétez votre profil d'entraînement pour des séances adaptées à votre
        niveau.
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/assessment"
          className="bg-ink text-canvas px-4 py-1.5 rounded-full text-sm font-medium"
        >
          Commencer
        </Link>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
          }}
          aria-label="Fermer"
          className="text-mute text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
