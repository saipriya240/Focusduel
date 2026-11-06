import { useEffect, useState } from 'react';
import { Award, Loader2, LogOut, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { CATEGORIES, PERSONALITIES } from '@/lib/format';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'Etc/UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Australia/Sydney', 'Africa/Lagos', 'Africa/Johannesburg',
];

export default function Settings() {
  const { profile, refresh } = useProfile();
  const [form, setForm] = useState(null);
  const [unlocked, setUnlocked] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || '',
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        focus_personality: profile.focus_personality || 'silent_assassin',
        daily_target_minutes: profile.daily_target_minutes || 120,
        preferred_session_minutes: profile.preferred_session_minutes || 25,
        productivity_category: profile.productivity_category || 'deep_work',
        timezone: profile.timezone || 'Etc/UTC',
        notifications_enabled: profile.notifications_enabled ?? true,
        battle_invites_enabled: profile.battle_invites_enabled ?? true,
        public_roasts: profile.public_roasts ?? true,
        activity_visibility: profile.activity_visibility || 'friends',
      });
    }
  }, [profile]);

  useEffect(() => {
    base44.entities.UserAchievement.filter({}, { limit: 50 }).then((res) => setUnlocked(res.items || []));
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set('avatar_url', file_url);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      await base44.entities.UserProfile.update(profile.id, {
        ...form,
        username: form.username.trim().toLowerCase(),
        display_name: form.display_name.trim() || form.username,
      });
      await refresh();
      setNotice('Saved.');
    } catch (e) {
      setNotice(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await base44.auth.logout();
    window.location.href = '/login';
  };

  if (!form) {
    return <div className="panel grid place-items-center py-24"><Loader2 className="animate-spin text-white/30" size={22} /></div>;
  }

  const unlockedCodes = new Set(unlocked.map((u) => u.code));

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Settings</p>
        <h1 className="mt-1 text-4xl sm:text-5xl">Tune your <span className="text-[#B6FF3B]">fighter.</span></h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              {form.avatar_url ? <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" /> : <span className="font-heading text-2xl text-white/25">{form.username.charAt(0).toUpperCase()}</span>}
            </div>
            <label className="btn-ghost cursor-pointer text-xs">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-xs">Username</span>
              <input value={form.username} onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))} className="field mt-1.5" maxLength={20} />
            </label>
            <label className="block">
              <span className="label-xs">Display name</span>
              <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} className="field mt-1.5" maxLength={40} />
            </label>
          </div>

          <label className="block">
            <span className="label-xs">Bio</span>
            <textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={2} className="field mt-1.5 resize-none" maxLength={140} placeholder="One line of intimidation." />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-xs">Focus personality</span>
              <select value={form.focus_personality} onChange={(e) => set('focus_personality', e.target.value)} className="field mt-1.5">
                {PERSONALITIES.map((p) => <option key={p.value} value={p.value} className="bg-[#0E0F11]">{p.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-xs">Main category</span>
              <select value={form.productivity_category} onChange={(e) => set('productivity_category', e.target.value)} className="field mt-1.5">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value} className="bg-[#0E0F11]">{c.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-xs">Daily target (min)</span>
              <input type="number" min="15" max="600" step="15" value={form.daily_target_minutes} onChange={(e) => set('daily_target_minutes', Number(e.target.value))} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label-xs">Session length (min)</span>
              <input type="number" min="5" max="180" value={form.preferred_session_minutes} onChange={(e) => set('preferred_session_minutes', Number(e.target.value))} className="field mt-1.5" />
            </label>
          </div>

          <label className="block">
            <span className="label-xs">Timezone</span>
            <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className="field mt-1.5">
              {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => <option key={tz} value={tz} className="bg-[#0E0F11]">{tz}</option>)}
            </select>
          </label>

          <div className="space-y-2">
            {[
              { key: 'notifications_enabled', label: 'In-app notifications' },
              { key: 'battle_invites_enabled', label: 'Accept battle invites' },
              { key: 'public_roasts', label: 'Allow AI roasts on my feed' },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <span className="text-sm">{row.label}</span>
                <button type="button" onClick={() => set(row.key, !form[row.key])} className={cn('relative h-6 w-11 rounded-full transition', form[row.key] ? 'bg-[#B6FF3B]' : 'bg-white/15')} aria-label={row.label}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-[#08090A] transition-all', form[row.key] ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <span className="text-sm">Activity visibility</span>
              <div className="flex gap-1">
                {[['friends', 'Squad'], ['public', 'All'], ['private', 'Me']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => set('activity_visibility', v)}
                    className={cn('rounded-lg px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest transition',
                      form.activity_visibility === v ? 'bg-[#B6FF3B] text-[#08090A]' : 'text-white/40 hover:text-white')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {notice && <p className="font-mono text-[10px] uppercase tracking-widest text-[#B6FF3B]">{notice}</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className="btn-acid text-xs">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save changes
            </button>
            <button type="button" onClick={logout} className="btn-ghost text-xs">
              <LogOut size={13} /> Log out
            </button>
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <p className="label-xs">Achievements</p>
            <span className="font-mono text-[9px] uppercase tracking-widest text-white/25">{unlocked.length}/{ALL_ACHIEVEMENTS.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {ALL_ACHIEVEMENTS.map((a) => {
              const has = unlockedCodes.has(a.code);
              return (
                <div key={a.code} className={cn('flex items-start gap-3 rounded-xl border p-3', has ? 'border-[#B6FF3B]/30 bg-[#B6FF3B]/5' : 'border-white/10 bg-white/[0.02]')}>
                  <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', has ? 'border-[#B6FF3B]/40 bg-[#B6FF3B]/10' : 'border-white/10 bg-white/[0.03]')}>
                    <Award size={15} className={has ? 'text-[#B6FF3B]' : 'text-white/25'} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold', has ? 'text-white' : 'text-white/45')}>{a.name}</p>
                    <p className="text-xs text-white/30">{a.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}