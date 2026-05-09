import { supabase } from "@/integrations/supabase/client";

/**
 * Check whether an email is on the private-beta whitelist.
 *
 * Calls a SECURITY DEFINER RPC instead of querying `email_whitelist` directly
 * — the table is locked down so the entire list cannot be enumerated. The RPC
 * returns one boolean per call, exposing only whether *this specific* email
 * is allowed.
 */
export const isEmailAllowed = async (email: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase.rpc("is_email_whitelisted", {
            email_in: email.toLowerCase(),
        });

        if (error) {
            console.error("Error checking whitelist:", error);
            return false;
        }

        return data === true;
    } catch (error) {
        console.error("Unexpected error checking whitelist:", error);
        return false;
    }
};
