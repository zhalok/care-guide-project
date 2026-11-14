import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, getMe, login as apiLogin } from './api';
import type { User } from './types';

const STORAGE_KEY = 'care-guide.token';

interface AuthState {
  token: string | null;
  user: User | null;
  /** True while a stored token is being checked on first load. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // sessionStorage: the token is gone when the tab closes.
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(STORAGE_KEY),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(token !== null);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Load the profile for a stored token (page refresh).
  useEffect(() => {
    if (!token || user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getMe(token)
      .then((me) => !cancelled && setUser(me))
      .catch((error: unknown) => {
        // Expired or revoked token: back to the login page.
        if (!cancelled && error instanceof ApiError) logout();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await apiLogin(email, password);
    const me = await getMe(accessToken);
    sessionStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);
    setUser(me);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, logout }),
    [token, user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
