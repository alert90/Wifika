'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit2, Users } from 'lucide-react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatNairobi, isExpiredNairobi as isExpired } from '@/lib/timezone';

interface HotspotUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  expiredAt: string | null;
  profile: { id: string; name: string; speed: string } | null;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
  speed: string;
  sellingPrice: number;
}

export default function HotspotUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<HotspotUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HotspotUser | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    profileId: '',
    notes: '',
  });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);

      const [uRes, pRes] = await Promise.all([
        fetch(`/api/hotspot/users?${params}`),
        fetch('/api/hotspot/profiles'),
      ]);

      const uData = await uRes.json();
      const pData = await pRes.json();

      if (uData.success) setUsers(uData.users || []);
      if (pData.profiles) setProfiles(pData.profiles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await load();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/hotspot/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        await showSuccess(editing ? 'Updated' : 'Created');
        setIsDialogOpen(false);
        setEditing(null);
        setForm({ name: '', phone: '', email: '', profileId: '', notes: '' });
        void load();
      } else {
        await showError(data.error || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const ok = await showConfirm('Delete this hotspot user?');
    if (!ok) {
      setDeleteId(null);
      return;
    }
    await fetch(`/api/hotspot/users?id=${deleteId}`, { method: 'DELETE' });
    await showSuccess('Deleted');
    setDeleteId(null);
    void load();
  };

  const openEdit = (u: HotspotUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      phone: u.phone,
      email: u.email || '',
      profileId: u.profile?.id || '',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" />
            Hotspot Users
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Users who can login with phone number (no voucher needed)
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ name: '', phone: '', email: '', profileId: '', notes: '' });
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg dark:bg-gray-700 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="isolated">Isolated</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profile</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No hotspot users yet
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-sm font-mono">{u.phone}</td>
                  <td className="px-4 py-3 text-sm">{u.profile?.name || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        u.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : u.status === 'blocked'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.expiredAt ? (
                      <span className={isExpired(u.expiredAt) ? 'text-red-600' : ''}>
                        {formatNairobi(u.expiredAt, 'dd/MM/yyyy')}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(u.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editing ? 'Edit' : 'Add'} Hotspot User
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                required
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              />
              <input
                required
                placeholder="Phone (e.g. 0712345678)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={!!editing}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 font-mono"
              />
              <input
                placeholder="Email (optional)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              />
              <select
                value={form.profileId}
                onChange={(e) => setForm({ ...form, profileId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="">-- Default profile --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.speed}
                  </option>
                ))}
              </select>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-sm w-full p-6">
            <p className="mb-4">Delete this hotspot user?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}