import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { CATEGORIES, PERSONALITIES } from '@/lib/format';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'Etc/UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Berlin', 'Europe/Madrid', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Australia/Sydney', 'Africa/Lagos', 'Africa/Johannesburg',
];

export default function Onboarding() {
  const { profile, refresh } = useProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const detectedTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';
  const [form, setForm] = useState({
    username: profile?.username || '',
    display_name: profile?.display_name || '',
    avatar_url: profile?.avatar_url || '',
    focus_personality: profile?.focus_personality || '',
    daily_target_minutes: profile?.daily_target_minutes || 120,
    preferred_session_minutes: profile?.preferred_session_minutes || 25,
    productivity_category: profile?.productivity_category || 'deep_work',
    timezone: profile?.timezone || (TIMEZONES.includes(detectedTZ) ? detectedTZ : 'Etc/UTC'),
    notifications_enabled: profile?.notifications_enabled ?? true,
    battle_invites_enabled: profile?.battle_invites_enabled ?? true,
    activity_visibility: profile?.activity_visibility || 'friends',
    public_roasts: profile?.public_roasts ?? true,
  });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const uploadAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set('avatar_url', file_url);
    } catch (e) {
      setError('Upload failed. Try a smaller image.');
    } finally {
      setUploading(false);
    }
  };

  const next = () => {
    setError('');
    if (step === 0) {
      const handle = form.username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
        setError('Username must be 3–20 characters: letters, numbers or underscores.');
        return;
      }
      if (!form.focus_personality) {
        setError('Pick your focus personality.');
        return;
      }
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const handle = form.username.trim().toLowerCase();
      const existing = await base44.entities.UserProfile.filter({ username: handle }, { limit: 1 });
      const taken = (existing.items || [])[0];
      if (taken && taken.id !== profile?.id) {
        setError('That username is taken. Try another.');
        setStep(0);
        return;
      }
      const payload = {
        ...form,
        username: handle,
        display_name: form.display_name.trim() || handle,
        onboarding_complete: true,
      };
      if (profile) await base44.entities.UserProfile.update(profile.id, payload);
      else await base44.entities.UserProfile.create(payload);
      await refresh();
      navigate('/');
    } catch (e) {
      setError(e?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const steps = ['Identity', 'Targets', 'Preferences'];

  return (
    <div className="min-h-screen bg-[#08090A] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#B6FF3B] font-heading text-xl text-[#08090A]">F</div>
          <span className="font-heading text-2xl tracking-wide">FOCUSDUEL</span>
        </div>

        <h1 className="mt-8 text-4xl sm:text-5xl">Build your fighter.</h1>
        <p className="mt-2 text-sm text-white/45">Three quick steps and your arena is ready.</p>

        <div className="mt-6 flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-[#B6FF3B]' : 'bg-white/10')} />
              <p className={cn('mt-2 font-mono text-[9px] uppercase tracking-widest', i <= step ? 'text-[#B6FF3B]' : 'text-white/30')}>
                {i + 1}. {s}
              </p>
            </div>
          ))}
        </div>

        <div className="panel mt-6 p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-heading text-2xl text-white/25">{form.username.charAt(0).toUpperCase() || '?'}</span>
                  )}
                </div>
                <label className="btn-ghost cursor-pointer text-xs">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
                </label>
              </div>

              <label className="block">
                <span className="label-xs">Username</span>
                <input
                  value={form.username}
                  onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))}
                  placeholder="silentassassin"
                  className="field mt-1.5"
                  maxLength={20}
                />
              </label>

              <label className="block">
                <span className="label-xs">Display name</span>
                <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="How rivals see you" className="field mt-1.5" maxLength={40} />
              </label>

              <div>
                <span className="label-xs">Focus personality</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => set('focus_personality', p.value)}
                      className={cn(
                        'rounded-xl border p-3 text-left transition',
                        form.focus_personality === p.value
                          ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                      )}
                    >
                      <p className={cn('font-heading text-lg', form.focus_personality === p.value ? 'text-[#B6FF3B]' : 'text-white')}>{p.label}</p>
                      <p className="mt-0.5 text-xs text-white/40">{p.desc}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/25">{p.time}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="label-xs">Daily focus target</span>
                  <span className="font-heading text-2xl text-[#B6FF3B]">{form.daily_target_minutes} min</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="480"
                  step="15"
                  value={form.daily_target_minutes}
                  onChange={(e) => set('daily_target_minutes', Number(e.target.value))}
                  className="mt-3 w-full accent-[#B6FF3B]"
                />
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/25">Roughly {(form.daily_target_minutes / 60).toFixed(1)} hours of deep work</p>
              </div>

              <div>
                <span className="label-xs">Preferred session length</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[15, 25, 45, 60, 90].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set('preferred_session_minutes', m)}
                      className={cn(
                        'rounded-full border px-4 py-2 font-mono text-xs transition',
                        form.preferred_session_minutes === m
                          ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                          : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
                      )}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="label-xs">Main productivity category</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('productivity_category', c.value)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
                        form.productivity_category === c.value
                          ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                          : 'border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <label className="block">
                <span className="label-xs">Timezone</span>
                <select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className="field mt-1.5">
                  {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz} value={tz} className="bg-[#0E0F11]">{tz}</option>
                  ))}
                </select>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-white/25">Used for streaks and daily goals</span>
              </label>

              {[
                { key: 'notifications_enabled', label: 'In-app notifications', desc: 'Battle invites, achievements, results' },
                { key: 'battle_invites_enabled', label: 'Accept battle invites', desc: 'Let friends challenge you' },
                { key: 'public_roasts', label: 'Allow roasts on my feed', desc: 'AI roasts when you miss a goal' },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="text-xs text-white/35">{row.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => set(row.key, !form[row.key])}
                    className={cn('relative h-6 w-11 shrink-0 rounded-full transition', form[row.key] ? 'bg-[#B6FF3B]' : 'bg-white/15')}
                    aria-label={row.label}
                  >
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-[#08090A] transition-all', form[row.key] ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </div>
              ))}

              <div>
                <span className="label-xs">Activity visibility</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { v: 'friends', l: 'Squad' },
                    { v: 'public', l: 'Everyone' },
                    { v: 'private', l: 'Just me' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => set('activity_visibility', o.v)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
                        form.activity_visibility === o.v
                          ? 'border-[#B6FF3B]/60 bg-[#B6FF3B]/10 text-[#B6FF3B]'
                          : 'border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25'
                      )}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost text-xs disabled:opacity-30">
              <ArrowLeft size={14} /> Back
            </button>
            {step < 2 ? (
              <button type="button" onClick={next} className="btn-acid text-xs">
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={saving} className="btn-acid text-xs">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enter the arena
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}