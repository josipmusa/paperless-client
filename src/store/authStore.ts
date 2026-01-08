import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../auth/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isCompanySetupComplete: boolean;
  setSession: (session: Session | null) => void;
  setCompanySetupComplete: (complete: boolean) => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  isCompanySetupComplete: false,

  setSession: (session) => set({ session, user: session?.user ?? null }),

  setCompanySetupComplete: (complete) => set({ isCompanySetupComplete: complete }),

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, isCompanySetupComplete: false });
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, isLoading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },
}));
