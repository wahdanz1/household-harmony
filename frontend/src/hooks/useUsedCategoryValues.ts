import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the set of `column` values already in use on `table` for this
 * household. Used to split a long category dropdown into a "Used" group
 * (categories the household actually uses) plus a "More" group (the rest),
 * so users only see the categories that matter to them.
 */
export function useUsedCategoryValues(
    table: "expenses" | "subscriptions" | "insurances",
    householdId: string | undefined,
    column: string = "category",
): Set<string> {
    const [used, setUsed] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!householdId) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from(table)
                .select(column)
                .eq("household_id", householdId);
            if (cancelled) return;
            const next = new Set<string>();
            for (const row of (data ?? []) as any[]) {
                const v = row[column];
                if (typeof v === "string" && v) next.add(v);
            }
            setUsed(next);
        })();
        return () => { cancelled = true; };
    }, [table, householdId, column]);

    return used;
}
