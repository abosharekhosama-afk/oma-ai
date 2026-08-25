'use client';
import { api } from '../../lib/api';

export function LogoutButton() {
  return (
    <button
      className="oma-btn"
      type="button"
      onClick={async () => {
        await api('/api/v1/auth/logout', { method: 'POST', body: '{}' });
        window.location.href = '/login';
      }}
    >
      Log out
    </button>
  );
}
