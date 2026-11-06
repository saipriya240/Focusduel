import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home as HomeIcon, Timer, Swords, Trophy, Flame, BarChart3, Users, Settings, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { cn } from '@/lib/utils';
import NotificationBell from '@/components/NotificationBell';

const NAV = [
  { to: '/', label: 'Command', icon: HomeIcon },
  { to: '/focus', label: 'Focus Room', icon: Timer },
  { to: '/battles', label: 'Battles', icon: Swords },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy },
  { to: '/hall-of-shame', label: 'Hall of Shame', icon: Flame },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/friends', label: 'Squad', icon: Users },
];

const MOBILE_NAV = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/battles', label: 'Duels', icon: Swords },
  { to: '/leaderboard', label: 'Ranks', icon: Trophy },
  { to: '/friends', label: 'Squad', icon: Users },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#B6FF3B]">
        <span className="font-heading text-xl leading-none text-[#08090A]">F</span>
      </div>
      <span className="font-heading text-2xl tracking-wide text-white">FOCUSDUEL</span>
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#08090A]">
        <Loader2 className="animate-spin text-[#B6FF3B]" size={24} />
      </div>
    );
  }

  if (!profile) return <Navigate to="/onboarding" replace />;

  const name = profile.display_name || profile.username || user?.full_name?.split(' ')[0] || 'Player';

  return (
    <div className="min-h-screen bg-[#08090A] text-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/10 bg-[#0B0C0E] px-4 py-6 lg:flex">
        <Logo />
        <nav className="mt-9 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cn(
                'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white/[0.06] text-white' : 'text-white/45 hover:bg-white/[0.03] hover:text-white/85'
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn('absolute left-0 h-5 w-[3px] rounded-r bg-[#B6FF3B] transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                  <Icon size={18} className={isActive ? 'text-[#B6FF3B]' : 'text-white/40 group-hover:text-white/70'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            'mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
            isActive ? 'bg-white/[0.06] text-white' : 'text-white/45 hover:bg-white/[0.03] hover:text-white/85'
          )}
        >
          <Settings size={18} className="text-white/40" /> Settings
        </NavLink>

        <NavLink to="/settings" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 transition hover:border-white/20">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#B6FF3B]/15 font-heading text-base text-[#B6FF3B]">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              : name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="truncate font-mono text-[9px] uppercase tracking-widest text-[#B6FF3B]/70">
              LVL {profile.level || 1} · {profile.streak || 0}d streak
            </p>
          </div>
        </NavLink>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#08090A]/85 px-4 backdrop-blur-xl lg:pl-[280px] lg:pr-8">
        <div className="lg:hidden"><Logo /></div>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-white/35 lg:block">
          Lock in · Show up · Win
        </p>
        <NotificationBell />
      </header>

      <main className="px-4 pb-28 pt-6 lg:pl-[280px] lg:pr-8 lg:pb-12">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[1180px]"
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#0B0C0E]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-[#B6FF3B]' : 'text-white/40'
            )}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}