import { useAuth } from './auth';
import { Dashboard } from './Dashboard';
import { LoginPage } from './LoginPage';

export function App() {
  const { token, user, loading } = useAuth();

  if (loading) return <p className="muted center">Loading…</p>;
  return token && user ? <Dashboard /> : <LoginPage />;
}
