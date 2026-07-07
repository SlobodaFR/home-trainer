import { createContext, useState } from 'react';

interface AnalysisContextValue {
  pendingSessionId: string | null;
  setPending: (id: string | null) => void;
}

export const AnalysisContext = createContext<AnalysisContextValue>({
  pendingSessionId: null,
  setPending: () => undefined,
});

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  return (
    <AnalysisContext.Provider
      value={{ pendingSessionId, setPending: setPendingSessionId }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}
