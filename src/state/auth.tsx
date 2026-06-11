import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AgeGroup,
  ConsentStatus,
  UserProfile,
  UserRole,
} from '@/types/motion';
import { supabase } from '@/config/supabase';
import { deleteAllMotionData } from '@/lib/storage/motionStore';

const PROFILE_KEY = '@breakcoach/profile';

interface AuthState {
  profile: UserProfile | null;
  loading: boolean;
  /** True until the user has completed onboarding (age + role). */
  needsOnboarding: boolean;
  /** Under-13 awaiting guardian consent before recording is allowed. */
  needsConsent: boolean;
  onboard: (input: { role: UserRole; ageGroup: AgeGroup }) => Promise<void>;
  grantGuardianConsent: () => Promise<void>;
  setRawVideoStorage: (allowed: boolean) => Promise<void>;
  deleteMyData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function consentForAge(age: AgeGroup): ConsentStatus {
  return age === 'under13' ? 'pending' : 'not_required';
}

function newId(): string {
  // Local profile id; when Supabase auth is wired, use the auth user id.
  return 'local-' + Math.abs(hash(String(Date.now()) + Math.floor(Math.random() * 1e9)));
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (raw) {
        try {
          setProfile(JSON.parse(raw) as UserProfile);
        } catch {
          /* ignore corrupt profile */
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (p: UserProfile | null) => {
    setProfile(p);
    if (p) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(PROFILE_KEY);
    // Best-effort remote profile sync (anonymized: role/age/consent only).
    if (supabase && p) {
      await supabase.from('profiles').upsert({
        id: p.id,
        role: p.role,
        age_group: p.ageGroup,
        consent_status: p.consentStatus,
        guardian_id: p.guardianId ?? null,
        allow_raw_video_storage: p.allowRawVideoStorage,
        allow_public_sharing: p.allowPublicSharing,
      });
    }
  }, []);

  const onboard = useCallback<AuthState['onboard']>(
    async ({ role, ageGroup }) => {
      const p: UserProfile = {
        id: newId(),
        role,
        ageGroup,
        consentStatus: consentForAge(ageGroup),
        guardianId: null,
        allowRawVideoStorage: false, // off by default, always
        allowPublicSharing: false,
      };
      await persist(p);
    },
    [persist]
  );

  const grantGuardianConsent = useCallback<AuthState['grantGuardianConsent']>(async () => {
    if (!profile) return;
    await persist({ ...profile, consentStatus: 'granted' });
  }, [profile, persist]);

  const setRawVideoStorage = useCallback<AuthState['setRawVideoStorage']>(
    async (allowed) => {
      if (!profile) return;
      await persist({ ...profile, allowRawVideoStorage: allowed });
    },
    [profile, persist]
  );

  const deleteMyData = useCallback<AuthState['deleteMyData']>(async () => {
    if (!profile) return;
    await deleteAllMotionData(profile.id);
  }, [profile]);

  const signOut = useCallback<AuthState['signOut']>(async () => {
    if (supabase) await supabase.auth.signOut();
    await persist(null);
  }, [persist]);

  const value = useMemo<AuthState>(
    () => ({
      profile,
      loading,
      needsOnboarding: !loading && !profile,
      needsConsent: !!profile && profile.consentStatus === 'pending',
      onboard,
      grantGuardianConsent,
      setRawVideoStorage,
      deleteMyData,
      signOut,
    }),
    [profile, loading, onboard, grantGuardianConsent, setRawVideoStorage, deleteMyData, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
