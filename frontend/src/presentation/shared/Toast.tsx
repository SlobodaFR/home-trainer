import type { FC } from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: FC<ToastProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-canvas px-4 py-2 rounded-full text-sm z-50 shadow-md"
    >
      {message}
    </div>
  );
};
