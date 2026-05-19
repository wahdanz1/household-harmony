import { supabase } from "@/integrations/supabase/client";

export interface HouseholdMembership {
    id: string;
    household_id: string;
    user_id: string;
    role: "owner" | "member";
    joined_at: string;
    pending_exit_at: string | null;
}

export interface Household {
    id: string;
    name: string;
    currency: string;
    created_at: string;
}

export interface ActiveHouseholdResult {
    membership: HouseholdMembership | null;
    household: Household | null;
    allMemberships: HouseholdMembership[];
}

/**
 * Gets the active household for a user.
 * 
 * Logic:
 * - Users can have TWO memberships: "owner" (their household) and "member" (joined household)
 * - Active household is determined by role: "member" takes precedence over "owner"
 * - Uses explicit role prioritization (not alphabetical sorting which is unreliable)
 * 
 * @param userId - The user's ID
 * @returns Object containing active membership, household, and all memberships
 */
export async function getActiveHousehold(userId: string): Promise<ActiveHouseholdResult> {
    // Fetch all memberships for the user
    const { data: memberships, error: membershipError } = await supabase
        .from("household_members")
        .select("*")
        .eq("user_id", userId);

    if (membershipError) {
        console.error("Error fetching memberships:", membershipError);
        return { membership: null, household: null, allMemberships: [] };
    }

    if (!memberships || memberships.length === 0) {
        return { membership: null, household: null, allMemberships: [] };
    }

    const active = memberships.filter(m => !m.pending_exit_at);
    const activeMembership = active.find(m => m.role === "member") || active.find(m => m.role === "owner");

    if (!activeMembership) {
        return { membership: null, household: null, allMemberships: memberships as HouseholdMembership[] };
    }

    // Fetch the household details
    const { data: household, error: householdError } = await supabase
        .from("households")
        .select("*")
        .eq("id", activeMembership.household_id)
        .single();

    if (householdError) {
        console.error("Error fetching household:", householdError);
        return {
            membership: activeMembership,
            household: null,
            allMemberships: memberships as HouseholdMembership[]
        };
    }

    return {
        membership: activeMembership,
        household: household as Household,
        allMemberships: memberships as HouseholdMembership[],
    };
}
