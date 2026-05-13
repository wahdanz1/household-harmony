import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; data: { user: User | null } | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any; data: { user: User | null } | null }>;
  signUpAndJoinHousehold: (
    email: string,
    password: string,
    fullName: string,
    inviteCode: string,
  ) => Promise<{ error: any; userId?: string; householdId?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Keep the user reference stable across token refreshes / focus events —
    // Supabase fires onAuthStateChange with a fresh `user` object even when
    // nothing about identity changed, which would otherwise cascade refetches
    // through every consumer (HouseholdContext, Overview, Expenses, Income).
    const applySession = (next: Session | null) => {
      setSession(next);
      setUser(prev => (prev?.id === next?.user?.id ? prev : next?.user ?? null));
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => applySession(session)
    );

    supabase.auth.getSession().then(({ data: { session } }) => applySession(session));

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, data: data ? { user: data.user } : null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || "",
        },
      },
    });
    return { error, data: data ? { user: data.user } : null };
  };

  const signUpAndJoinHousehold = async (email: string, password: string, fullName: string, inviteCode: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          skip_default_household: true,
        },
      },
    });

    if (signUpError || !authData.user) {
      return { error: signUpError };
    }

    const { data: redeemData, error: redeemError } = await supabase.rpc("redeem_invite", {
      invite_code_in: inviteCode.toUpperCase(),
    });

    if (redeemError) {
      return { error: redeemError };
    }

    const householdId = (redeemData as { household_id?: string } | null)?.household_id;
    return { error: null, userId: authData.user.id, householdId };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signUpAndJoinHousehold, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
