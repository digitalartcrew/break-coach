import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeGroup, ConsentStatus, UserProfile, UserRole } from '@/types/motion';
import { isSupabaseConfigured, supabase } from '@/config/supabase';
import { deleteAllMotionData } from '@/lib/storage/motionStore';

const PROFILE_KEY = '@breakcoach/profile';

/**
 * Auth modes:
 *  - 'remote': Supabase is configured AND an (anonymous) session is active.
 *    Profile ids equal auth.uid() so row-level security applies; profile +
 *    motion data sync to the backend.
 *  - 'local': Supabase absent or unreachable. Everything lives in AsyncStorage.
 *    The app is fully functional offline — this is the privacy-first default.
 */
type AuthMode = 'remote' | 'local';

interface AuthState {
  profile: UserProfile | null;
  loading: boolean;
  /** True until the user has completed onboarding (age + role). */
  needsOnboarding: boolean;
  /** Under-13 awaiting guardian consent before recording is allowed. */
  needsConsent: boolean;
  /** Whether anonymized data is being synced to Supabase this session. */
  cloudEnabled: boolean;
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

function localId(): string {
  return 'local-' + Math.abs(hash(String(Date.now()) + Math.floor(Math.random() * 1e9)));
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

interface ProfileRow {
  id: string;
  role: UserRole;
  age_group: AgeGroup;
  consent_status: ConsentStatus;
  guardian_id: string | null;
  allow_raw_video_storage: boolean;
  allow_public_sharing: boolean;
}

function rowToProfile(r: ProfileRow): UserProfile {
  return {
    id: r.id,
    role: r.role,
    ageGroup: r.age_group,
    consentStatus: r.consent_status,
    guardianId: r.guardian_id,
    allowRawVideoStorage: r.allow_raw_video_storage,
    allowPublicSharing: r.allow_public_sharing,
  };
}

function profileToRow(p: UserProfile): ProfileRow {
  return {
    id: p.id,
    role: p.role,
    age_group: p.ageGroup,
    consent_status: p.consentStatus,
    guardian_id: p.guardianId ?? null,
    allow_raw_video_storage: p.allowRawVideoStorage,
    allow_public_sharing: p.allowPublicSharing,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>('local');
  // The id to use for a not-yet-onboarded user (auth uid in remote mode).
  const pendingId = useRef<string | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    // Try remote (anonymous) auth first when Supabase is configured.
    if (isSupabaseConfigured && supabase) {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
        }
        if (session) {
          const uid = session.user.id;
          pendingId.current = uid;
          setMode('remote');
          const { data: row } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();
          if (row) {
            const p = rowToProfile(row as ProfileRow);
            setProfile(p);
            await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
          } else {
            setProfile(null); // -> onboarding
          }
          setLoading(false);
          return;
        }
      } catch (e) {
        // Anonymous auth disabled or network down: fall back to local mode so
        // the app always works. (Enable Authentication → Anonymous sign-ins in
        // the Supabase dashboard to use the cloud backend.)
        console.warn('[auth] remote sign-in failed, using local mode:', (e as Error).message);
      }
    }

    // Local mode.
    setMode('local');
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      try {
        setProfile(JSON.parse(raw) as UserProfile);
      } catch {
        /* ignore corrupt profile */
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const persist = useCallback(
    async (p: UserProfile | null) => {
      setProfile(p);
      if (p) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      else await AsyncStorage.removeItem(PROFILE_KEY);
      if (mode === 'remote' && supabase && p) {
        const { error } = await supabase.from('profiles').upsert(profileToRow(p));
        if (error) console.warn('[auth] profile upsert failed:', error.message);
      }
    },
    [mode]
  );

  const onboard = useCallback<AuthState['onboard']>(
    async ({ role, ageGroup }) => {
      const id = mode === 'remote' && pendingId.current ? pendingId.current : localId();
      await persist({
        id,
        role,
        ageGroup,
        consentStatus: consentForAge(ageGroup),
        guardianId: null,
        allowRawVideoStorage: false, // off by default, always
        allowPublicSharing: false,
      });
    },
    [mode, persist]
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
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    setProfile(null);
    await AsyncStorage.removeItem(PROFILE_KEY);
    pendingId.current = null;
    // Re-establish a fresh (anonymous) session / local profile slot.
    await bootstrap();
  }, [bootstrap]);

  const value = useMemo<AuthState>(
    () => ({
      profile,
      loading,
      needsOnboarding: !loading && !profile,
      needsConsent: !!profile && profile.consentStatus === 'pending',
      cloudEnabled: mode === 'remote',
      onboard,
      grantGuardianConsent,
      setRawVideoStorage,
      deleteMyData,
      signOut,
    }),
    [profile, loading, mode, onboard, grantGuardianConsent, setRawVideoStorage, deleteMyData, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
