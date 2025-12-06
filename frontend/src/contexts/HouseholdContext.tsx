import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { getActiveHousehold } from "@/utils/householdHelpers";

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
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [household, setHousehold] = useState<Household | null>(null);
    const [members, setMembers] = useState<HouseholdMember[]>([]);
    const [coParents, setCoParents] = useState<CoParent[]>([]);
    const [userRole, setUserRole] = useState<string>("");
    const [loading, setLoading] = useState(true);

    const fetchHouseholdData = useCallback(async () => {
        if (!user) {
            setHousehold(null);
            setMembers([]);
            setCoParents([]);
            setUserRole("");
            setLoading(false);
            return;
        }

        try {
            // Get active household
            const { membership, household: householdData } = await getActiveHousehold(user.id);

            if (!membership || !householdData) {
                setLoading(false);
                return;
            }

            setUserRole(membership.role);

            // Fetch complete household data with all related info
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
                    .select("*, profiles(full_name, email, avatar_url)")
                    .eq("household_id", membership.household_id),
                supabase
                    .from("co_parents")
                    .select("*")
                    .eq("household_id", membership.household_id),
            ]);

            setHousehold(fullHousehold as Household);
            setMembers((membersData || []) as HouseholdMember[]);
            setCoParents((coParentsData || []) as CoParent[]);
        } catch (error) {
            console.error("Error fetching household data:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Fetch on user change
    useEffect(() => {
        fetchHouseholdData();
    }, [fetchHouseholdData]);

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
