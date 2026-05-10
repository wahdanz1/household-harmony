import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubjectType = "member" | "car" | "kid" | "pet" | "other";

export interface SubjectOption {
    id: string;
    name: string;
    type: SubjectType;
    sort_order: number;
}

export function useHouseholdSubjects(householdId: string | undefined) {
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);

    useEffect(() => {
        let cancelled = false;
        if (!householdId) {
            setSubjects([]);
            return;
        }
        (async () => {
            const { data } = await supabase
                .from("subjects")
                .select("id, name, type, sort_order")
                .eq("household_id", householdId)
                .order("sort_order")
                .order("name");
            if (!cancelled) setSubjects((data as SubjectOption[]) ?? []);
        })();
        return () => { cancelled = true; };
    }, [householdId]);

    return subjects;
}
