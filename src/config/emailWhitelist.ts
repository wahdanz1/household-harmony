import { supabase } from "@/integrations/supabase/client";

export const isEmailAllowed = async (email: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('email_whitelist')
            .select('email')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (error) {
            console.error('Error checking whitelist:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Unexpected error checking whitelist:', error);
        return false;
    }
};
