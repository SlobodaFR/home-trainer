import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { apiClient, CurrentUser } from '../../infrastructure/api-client';

export interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiClient
      .fetchCurrentUser()
      .then(setUser)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
