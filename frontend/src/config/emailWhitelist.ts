import { supabase } from "@/integrations/supabase/client";

/** Check whether an email is on the private-beta whitelist. */
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
