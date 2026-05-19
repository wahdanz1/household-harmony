import { supabase } from "@/integrations/supabase/client";

type DecryptFn = (records: any[]) => Promise<any[]>;

export async function fetchMostRecentByKey(params: {
    table: "monthly_incomes" | "monthly_expenses";
    keyField: "income_source_id" | "expense_id";
    keys: string[];
    householdId: string;
    beforeMonth: string;
    decrypt: DecryptFn;
}): Promise<Map<string, any>> {
    const { table, keyField, keys, householdId, beforeMonth, decrypt } = params;
    const result = new Map<string, any>();
    if (keys.length === 0) return result;

    const { data } = await supabase
        .from(table)
        .select("*")
        .eq("household_id", householdId)
        .lt("month", beforeMonth)
        .order("month", { ascending: false });

    const decrypted = data ? await decrypt(data) : [];
    for (const record of decrypted) {
        const key = record[keyField];
        if (key && !result.has(key)) {
            result.set(key, record);
        }
    }
    return result;
}
