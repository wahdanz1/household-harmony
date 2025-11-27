import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signUpAndJoinHousehold: (email: string, password: string, fullName: string, householdId: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || "",
        },
      },
    });
    return { error };
  };

  const signUpAndJoinHousehold = async (email: string, password: string, fullName: string, householdId: string) => {
    const redirectUrl = `${window.location.origin}/`;

    // Create the user account
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          skip_default_household: true, // Signal to not create default household
        },
      },
    });

    if (signUpError || !authData.user) {
      return { error: signUpError };
    }

    // Add user to the specified household
    const { error: memberError } = await supabase
      .from("household_members")
      .insert({
        household_id: householdId,
        user_id: authData.user.id,
        role: "member",
      });

    if (memberError) {
      return { error: memberError };
    }

    // Clean up: Delete any auto-created default household
    // This happens when a user joins before signup - the trigger creates a default household
    // but we want them in the invited household instead
    const { data: ownedHouseholds } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", authData.user.id);

    if (ownedHouseholds && ownedHouseholds.length > 0) {
      // Delete the auto-created household and its membership
      for (const household of ownedHouseholds) {
        await supabase
          .from("household_members")
          .delete()
          .eq("household_id", household.id)
          .eq("user_id", authData.user.id);

        await supabase
          .from("households")
          .delete()
          .eq("id", household.id);
      }
    }

    // Update invite status to accepted and deactivate
    await supabase
      .from("household_invites")
      .update({
        status: "accepted",
        is_active: false
      })
      .eq("household_id", householdId)
      .eq("is_active", true);

    return { error: null };
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
