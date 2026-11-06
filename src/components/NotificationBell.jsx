import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);

  const load = () => {
    if (!user?.id) return;
    base44.entities.Notification.filter({ user_id: user.id }, { sort: '-created_date', limit: 20 })
      .then((res) => setItems(res.items || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (!event?.data?.user_id || event.data.user_id === user?.id) load();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const openItem = async (n) => {
    if (!n.read) {
      await base44.entities.Notification.update(n.id, { read: true });
      setItems((list) => list.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    const unreadItems = items.filter((n) => !n.read);
    await Promise.all(unreadItems.map((n) => base44.entities.Notification.update(n.id, { read: true })));
    setItems((list) => list.map((i) => ({ ...i, read: true })));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.02] text-white/60 transition hover:border-white/25 hover:text-white"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#B6FF3B] px-1 font-mono text-[9px] font-bold text-[#08090A]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0E0F11] shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="label-xs">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="font-mono text-[9px] uppercase tracking-widest text-[#B6FF3B] hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-white/35">You're all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn('flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.03]', !n.read && 'bg-[#B6FF3B]/5')}
                  >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-white/20' : 'bg-[#B6FF3B]')} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-white/90">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[11px] leading-relaxed text-white/40">{n.body}</span>}
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-white/20">{timeAgo(n.created_date)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}