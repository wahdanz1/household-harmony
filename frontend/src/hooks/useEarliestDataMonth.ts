import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useEarliestDataMonth(householdId: string | undefined): string | null {
    const [earliest, setEarliest] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!householdId) {
            setEarliest(null);
            return;
        }
        (async () => {
            const [incomeRes, expenseRes] = await Promise.all([
                supabase
                    .from("monthly_incomes")
                    .select("month")
                    .eq("household_id", householdId)
                    .order("month", { ascending: true })
                    .limit(1)
                    .maybeSingle(),
                supabase
                    .from("monthly_expenses")
                    .select("month")
                    .eq("household_id", householdId)
                    .order("month", { ascending: true })
                    .limit(1)
                    .maybeSingle(),
            ]);
            if (cancelled) return;
            const months = [incomeRes.data?.month, expenseRes.data?.month].filter(
                (m): m is string => typeof m === "string" && m.length > 0,
            );
            months.sort();
            setEarliest(months[0] ?? null);
        })();
        return () => {
            cancelled = true;
        };
    }, [householdId]);

    return earliest;
}
