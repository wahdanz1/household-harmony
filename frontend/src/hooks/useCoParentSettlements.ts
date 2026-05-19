import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { useEncryptedFields, monthlyIncomeFields, insuranceFields, sharedExpenseFields } from "@/hooks/useEncryptedFields";

export interface CoParentSettlement {
    incomeReceived: number;
    yourShareOfIncome: number;
    insurancePaid: number;
    theirShareOfInsurance: number;
    expensesYouPaid: number;
    expensesTheyPaid: number;
    netAmount: number;
}

interface UseCoParentSettlementsArgs {
    householdId: string | undefined;
    coParents: { id: string }[];
}

export function useCoParentSettlements({ householdId, coParents }: UseCoParentSettlementsArgs) {
    const [settlements, setSettlements] = useState<Record<string, CoParentSettlement>>({});

    const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
    const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);

    const refetch = useCallback(async () => {
        if (!householdId || coParents.length === 0) {
            setSettlements({});
            return;
        }

        const currentMonth = getCurrentFinancialMonth();
        const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth);
        const currentMonthNumber = new Date().getMonth() + 1;
        const monthStartStr = format(monthStart, "yyyy-MM-dd");
        const monthEndStr = format(monthEnd, "yyyy-MM-dd");
        const coParentIds = coParents.map(cp => cp.id);

        const [incomesResult, insurancesResult, expensesResult] = await Promise.all([
            supabase
                .from("monthly_incomes")
                .select("encrypted_budget_snapshot, encrypted_actual_amount, share_percentage, is_encrypted, co_parent_id")
                .eq("household_id", householdId)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr)
                .eq("is_shared", true)
                .in("co_parent_id", coParentIds),
            supabase
                .from("insurances")
                .select("encrypted_budget, share_percentage, billing_month, is_encrypted, co_parent_id")
                .eq("household_id", householdId)
                .eq("is_shared", true)
                .in("co_parent_id", coParentIds)
                .eq("is_active", true)
                .is("archived_at", null)
                .eq("billing_month", currentMonthNumber),
            supabase
                .from("shared_expenses")
                .select("encrypted_amount, paid_by, is_encrypted, co_parent_id")
                .eq("household_id", householdId)
                .in("co_parent_id", coParentIds)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr),
        ]);

        const decryptedIncomes = (await decryptIncomes(incomesResult.data || [])) as any[];
        const decryptedInsurances = (await decryptInsurances(insurancesResult.data || [])) as any[];
        const decryptedExpenses = (await decryptShared(expensesResult.data || [])) as any[];

        const next: Record<string, CoParentSettlement> = {};

        for (const coParent of coParents) {
            const sharedIncomes = decryptedIncomes.filter(r => r.co_parent_id === coParent.id);
            const sharedInsurances = decryptedInsurances.filter(r => r.co_parent_id === coParent.id);
            const sharedExpenses = decryptedExpenses.filter(r => r.co_parent_id === coParent.id);

            const incomeReceived = sharedIncomes.reduce((sum, inc) => sum + parseFloat(((inc.actual_amount ?? inc.budget_snapshot) || 0).toString()), 0);
            const yourShareOfIncome = sharedIncomes.reduce((sum, inc) => {
                const sharePercentage = parseFloat((inc.share_percentage || 0).toString());
                return sum + (parseFloat(((inc.actual_amount ?? inc.budget_snapshot) || 0).toString()) * sharePercentage / 100);
            }, 0);

            let insurancePaid = 0;
            let theirShareOfInsurance = 0;
            sharedInsurances.forEach((ins) => {
                const amount = parseFloat((ins.budget || 0).toString());
                insurancePaid += amount;
                theirShareOfInsurance += amount * parseFloat((ins.share_percentage || 0).toString()) / 100;
            });

            let expensesYouPaid = 0;
            let expensesTheyPaid = 0;
            sharedExpenses.forEach((exp) => {
                const amount = parseFloat((exp.amount || 0).toString());
                if (exp.paid_by === "user") expensesYouPaid += amount;
                else expensesTheyPaid += amount;
            });

            const amountOwedFromIncome = incomeReceived - yourShareOfIncome;
            const netAmount = amountOwedFromIncome + theirShareOfInsurance + (expensesTheyPaid / 2) - (expensesYouPaid / 2);

            next[coParent.id] = {
                incomeReceived,
                yourShareOfIncome,
                insurancePaid,
                theirShareOfInsurance,
                expensesYouPaid,
                expensesTheyPaid,
                netAmount,
            };
        }

        setSettlements(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [householdId, coParents]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { settlements, refetch };
}
