import { useCallback, useState } from 'react';
import { listAllNotes, listMyNotes, listUsers } from './api';
import { useAuth } from './auth';
import { PagedPanel } from './PagedPanel';
import type { Note, User } from './types';
import { usePagedList } from './usePagedList';

type TabId = 'mine' | 'all' | 'users';

interface Tab {
  id: TabId;
  label: string;
  adminOnly: boolean;
}

// The API enforces permissions; hiding tabs here only avoids dead ends.
const TABS: Tab[] = [
  { id: 'mine', label: 'My notes', adminOnly: false },
  { id: 'all', label: 'All notes', adminOnly: true },
  { id: 'users', label: 'Users', adminOnly: true },
];

const formatDate = (iso: string) => new Date(iso).toLocaleString();

export function Dashboard() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState<TabId>('mine');

  if (!user) return null;
  const tabs = TABS.filter((tab) => !tab.adminOnly || user.role === 'admin');

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Care Guide</h1>
        <div className="who">
          <span>
            {user.name} <span className="badge">{user.role}</span>
          </span>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? 'tab active' : 'tab'}
            aria-current={tab.id === active ? 'page' : undefined}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {active === 'users' ? (
          <UsersPanel />
        ) : (
          <NotesPanel key={active} scope={active === 'all' ? 'all' : 'mine'} />
        )}
      </main>
    </div>
  );
}

function NotesPanel({ scope }: { scope: 'mine' | 'all' }) {
  const { token, logout } = useAuth();
  const fetchPage = useCallback(
    (cursor?: string) =>
      scope === 'all'
        ? listAllNotes(token ?? '', cursor)
        : listMyNotes(token ?? '', cursor),
    [token, scope],
  );
  const list = usePagedList<Note>(fetchPage, logout);

  return (
    <PagedPanel
      list={list}
      getKey={(note) => note._id}
      emptyText="No notes yet."
      renderItem={(note) => (
        <>
          <h3>{note.title}</h3>
          <p>{note.content}</p>
          <p className="muted small">{formatDate(note.createdAt)}</p>
        </>
      )}
    />
  );
}

function UsersPanel() {
  const { token, logout } = useAuth();
  const fetchPage = useCallback(
    (cursor?: string) => listUsers(token ?? '', cursor),
    [token],
  );
  const list = usePagedList<User>(fetchPage, logout);

  return (
    <PagedPanel
      list={list}
      getKey={(user) => user._id}
      emptyText="No users."
      renderItem={(user) => (
        <>
          <h3>
            {user.name} <span className="badge">{user.role}</span>
          </h3>
          <p>{user.email}</p>
          <p className="muted small">Joined {formatDate(user.createdAt)}</p>
        </>
      )}
    />
  );
}
