import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const ProfileContext = createContext(null);

export const useProfile = () => useContext(ProfileContext);

export default function ProfileProvider() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await base44.entities.UserProfile.filter({ created_by_id: user.id }, { limit: 1 });
      setProfile((res.items || [])[0] || null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh().catch((e) => {
      setError(e);
      setLoading(false);
    });
  }, [refresh]);

  return (
    <ProfileContext.Provider value={{ profile, loading, error, refresh, setProfile }}>
      <Outlet />
    </ProfileContext.Provider>
  );
}