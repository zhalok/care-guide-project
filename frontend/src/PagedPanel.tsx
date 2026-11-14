import type { ReactNode } from 'react';
import type { PagedList } from './usePagedList';

interface Props<T> {
  list: PagedList<T>;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
  emptyText: string;
}

/** A list with loading, error, empty and "Load more" states. */
export function PagedPanel<T>({ list, renderItem, getKey, emptyText }: Props<T>) {
  const { items, hasMore, loading, error, errorStatus, loadMore } = list;

  return (
    <div>
      {error && (
        <p role="alert" className="error">
          {errorStatus === 403
            ? 'You do not have permission to view this.'
            : error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="muted">{emptyText}</p>
      )}

      <ul className="list">
        {items.map((item) => (
          <li key={getKey(item)} className="card">
            {renderItem(item)}
          </li>
        ))}
      </ul>

      {loading && <p className="muted">Loading…</p>}

      {hasMore && !loading && (
        <button type="button" className="secondary" onClick={loadMore}>
          Load more
        </button>
      )}
    </div>
  );
}
