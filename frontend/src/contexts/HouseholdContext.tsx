/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useEncryption } from "./EncryptionContext";
import { getActiveHousehold } from "@/utils/householdHelpers";
import { toast } from "@/hooks/use-toast";

// Types
export interface Household {
    id: string;
    name: string;
    currency: string;
    financial_month_start?: number | null;
    enable_credit_cards?: boolean;
    enable_shared_expenses?: boolean;
    owner_id: string;
    created_at: string;
}

export interface HouseholdMember {
    id: string;
    user_id: string;
    household_id: string;
    role: "owner" | "member";
    joined_at: string;
    profiles?: {
        full_name: string;
        email: string;
        avatar_url?: string;
    };
}

export interface CoParent {
    id: string;
    name: string;
    household_id: string;
}

interface HouseholdContextType {
    household: Household | null;
    members: HouseholdMember[];
    coParents: CoParent[];
    userRole: string;
    loading: boolean;
    financialMonthStart: number;
    refresh: () => Promise<void>;
    /** Bumps on every successful refresh. Page-level fetch effects include
     *  this in their deps so they re-run after flows that mutate the active
     *  household's data (bring-items, planning, etc.) without us having to
     *  thread bespoke signals through every page. */
    dataVersion: number;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const { isUnlocked } = useEncryption();
    const [household, setHousehold] = useState<Household | null>(null);
    const [members, setMembers] = useState<HouseholdMember[]>([]);
    const [coParents, setCoParents] = useState<CoParent[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [dataVersion, setDataVersion] = useState(0);

    const userId = user?.id;
    // Concurrent fetches (e.g. an effect-triggered refetch racing the wizard's
    // explicit refresh) would otherwise let a stale empty result overwrite a
    // fresh complete one.
    const fetchGenRef = useRef(0);

    const fetchHouseholdData = useCallback(async () => {
        const gen = ++fetchGenRef.current;
        const isLatest = () => gen === fetchGenRef.current;

        if (!userId) {
            if (!isLatest()) return;
            setHousehold(null);
            setMembers([]);
            setCoParents([]);
            setUserRole("");
            setLoading(false);
            return;
        }

        try {
            const { membership, household: householdData } = await getActiveHousehold(userId);
            if (!isLatest()) return;

            if (!membership || !householdData) {
                setHousehold(null);
                setMembers([]);
                setCoParents([]);
                setUserRole("");
                setLoading(false);
                return;
            }

            const [
                { data: fullHousehold },
                { data: membersData },
                { data: coParentsData },
            ] = await Promise.all([
                supabase
                    .from("households")
                    .select("*")
                    .eq("id", membership.household_id)
                    .single(),
                supabase
                    .from("household_members")
                    .select("*, profiles(full_name, email, avatar_url, birthdate, email_public)")
                    .eq("household_id", membership.household_id),
                supabase
                    .from("co_parents")
                    .select("*")
                    .eq("household_id", membership.household_id),
            ]);
            if (!isLatest()) return;

            setUserRole(membership.role);
            setHousehold(fullHousehold as Household);
            setMembers((membersData || []) as HouseholdMember[]);
            setCoParents((coParentsData || []) as CoParent[]);
        } catch (error) {
            console.error("Error fetching household data:", error);
        } finally {
            if (isLatest()) {
                setLoading(false);
                setDataVersion(v => v + 1);
            }
        }
    }, [userId]);

    useEffect(() => {
        // Reset loading so consumers re-show skeletons across the userId boundary.
        // isUnlocked is in the dep list so HouseholdContext discovers a household
        // bootstrapped by unlockWithPassword (stranded user → new personal household).
        setLoading(true);
        fetchHouseholdData();
    }, [fetchHouseholdData, isUnlocked]);

    // Live notification: if someone else (typically an owner) soft-removes the
    // current user, reload so they land in the exit-dialog flow. Self-initiated
    // exits (the user accepting an invite to another household, or leaving
    // their own household) skip the destructive toast — those flows manage the
    // transition in-place without a reload.
    useEffect(() => {
        if (!userId) return;
        const channel = supabase
            .channel(`household_members:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "household_members",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const oldPending = (payload.old as any)?.pending_exit_at ?? null;
                    const newPending = (payload.new as any)?.pending_exit_at ?? null;
                    if (oldPending || !newPending) return;
                    const initiator = (payload.new as any)?.pending_exit_initiated_by ?? null;
                    if (initiator === userId) return;
                    toast({
                        title: "You've been removed",
                        description: "Reloading so you can pick which items to bring with you…",
                        variant: "destructive",
                    });
                    setTimeout(() => window.location.reload(), 3000);
                },
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    // Computed value
    const financialMonthStart = household?.financial_month_start || 25;

    return (
        <HouseholdContext.Provider
            value={{
                household,
                members,
                coParents,
                userRole,
                loading,
                financialMonthStart,
                refresh: fetchHouseholdData,
                dataVersion,
            }}
        >
            {children}
        </HouseholdContext.Provider>
    );
};

export const useHousehold = () => {
    const context = useContext(HouseholdContext);
    if (context === undefined) {
        throw new Error("useHousehold must be used within a HouseholdProvider");
    }
    return context;
};
