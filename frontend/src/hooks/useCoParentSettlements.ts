import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { useEncryptedFields, monthlyIncomeFields, monthlyInsuranceFields, insuranceFields, incomeSourceFields, sharedExpenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { billsInFinancialMonth } from "@/utils/billingEvents";
import { useEncryption, spaceScope } from "@/contexts/EncryptionContext";

/** A one-off expense flagged as shared, after decryption. */
interface SharedOneOffRow {
    co_parent_id: string | null;
    share_percentage: number | null;
    budget_snapshot?: number | string | null;
    actual_amount?: number | string | null;
}

export interface CoParentSettlement {
    incomeReceived: number;
    yourShareOfIncome: number;
    insurancePaid: number;
    theirShareOfInsurance: number;
    expensesYouPaid: number;
    expensesTheyPaid: number;
    /** One-off costs you paid and split, and the part they owe you. */
    oneOffsYouPaid: number;
    theirShareOfOneOffs: number;
    /** Costs the co-parent published to the shared space, your share of them. */
    theirCostsYourShare: number;
    /** Income the co-parent published, your share of it. */
    theirIncomeYourShare: number;
    /** True once the other side is in the space and publishing. */
    isTwoSided: boolean;
    netAmount: number;
}

interface UseCoParentSettlementsArgs {
    householdId: string | undefined;
    coParents: { id: string; space_id?: string | null }[];
    userId?: string;
    financialMonthStart?: number;
}

export function useCoParentSettlements({ householdId, coParents, userId, financialMonthStart = 25 }: UseCoParentSettlementsArgs) {
    const [settlements, setSettlements] = useState<Record<string, CoParentSettlement>>({});
    const { decryptFor, hasScopeKey } = useEncryption();

    const { decryptRecords: decryptIncomes } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptIncomeSources } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptInsurances } = useEncryptedFields(monthlyInsuranceFields);
    const { decryptRecords: decryptInsuranceSources } = useEncryptedFields(insuranceFields);
    const { decryptRecords: decryptShared } = useEncryptedFields(sharedExpenseFields);
    const { decryptRecords: decryptMonthlyExpenses } = useEncryptedFields(monthlyExpenseFields);

    const refetch = useCallback(async () => {
        if (!householdId || coParents.length === 0) {
            setSettlements({});
            return;
        }

        const currentMonth = getCurrentFinancialMonth(financialMonthStart);
        const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);
        const monthStartStr = format(monthStart, "yyyy-MM-dd");
        const monthEndStr = format(monthEnd, "yyyy-MM-dd");
        const coParentIds = coParents.map(cp => cp.id);

        const [incSourcesResult, monthlyIncResult, insSourcesResult, monthlyInsResult, expensesResult, oneOffsResult] = await Promise.all([
            // Shared income sources are the truth for shared-ness; monthly_incomes
            // only overrides the per-month amount (mirrors the insurance handling).
            supabase
                .from("income_sources")
                .select("id, share_percentage, co_parent_id, encrypted_budget, is_encrypted")
                .eq("household_id", householdId)
                .eq("is_shared", true)
                .eq("is_active", true)
                .is("archived_at", null)
                .in("co_parent_id", coParentIds),
            supabase
                .from("monthly_incomes")
                .select("income_source_id, encrypted_budget_snapshot, encrypted_actual_amount, is_encrypted")
                .eq("household_id", householdId)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr),
            // Shared insurances (source rows) — used to determine which bill in current FM via date-math.
            supabase
                .from("insurances")
                .select("id, billing_cycle, billing_month, billing_day, is_active, archived_at, share_percentage, co_parent_id, encrypted_budget, is_encrypted")
                .eq("household_id", householdId)
                .eq("is_shared", true)
                .eq("is_active", true)
                .is("archived_at", null)
                .in("co_parent_id", coParentIds),
            // Any reconciled monthly_insurances rows for current FM override source.budget.
            supabase
                .from("monthly_insurances")
                .select("insurance_id, encrypted_budget_snapshot, encrypted_actual_amount, is_encrypted")
                .eq("household_id", householdId)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr),
            // Legacy: the retired co-parent tab wrote here. Still counted so past
            // months keep their figures; nothing new is written to it.
            supabase
                .from("shared_expenses")
                .select("encrypted_amount, paid_by, is_encrypted, co_parent_id")
                .eq("household_id", householdId)
                .in("co_parent_id", coParentIds)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr),
            supabase
                .from("monthly_expenses")
                .select("encrypted_budget_snapshot, encrypted_actual_amount, is_encrypted, co_parent_id, share_percentage")
                .eq("household_id", householdId)
                .eq("is_shared", true)
                .in("co_parent_id", coParentIds)
                .gte("month_end", monthStartStr)
                .lte("month_start", monthEndStr),
        ]);

        const decryptedIncSources = (await decryptIncomeSources(incSourcesResult.data || [])) as any[];
        const decryptedMonthlyInc = (await decryptIncomes(monthlyIncResult.data || [])) as any[];
        const decryptedInsSources = (await decryptInsuranceSources(insSourcesResult.data || [])) as any[];
        const decryptedMonthlyIns = (await decryptInsurances(monthlyInsResult.data || [])) as any[];
        const decryptedExpenses = (await decryptShared(expensesResult.data || [])) as any[];
        const decryptedOneOffs = (await decryptMonthlyExpenses(oneOffsResult.data || [])) as unknown as SharedOneOffRow[];

        // Only claims the OTHER side published. Our own published claims mirror
        // the insurances and income already counted above, so folding them in
        // would count the same money twice.
        const incomingBySpace = new Map<string, { kind: string; amount: number; share: number }[]>();
        const spaceIds = coParents.map(cp => cp.space_id).filter((id): id is string => !!id);

        for (const spaceId of spaceIds) {
            const scope = spaceScope(spaceId);
            if (!hasScopeKey(scope)) continue;

            const [{ data: claimRows }, { data: monthRows }] = await Promise.all([
                supabase
                    .from("shared_cost_claims")
                    .select("id, published_by, source_kind, encrypted_amount, encrypted_share_percentage")
                    .eq("space_id", spaceId)
                    .eq("is_active", true),
                supabase
                    .from("shared_cost_claim_months")
                    .select("claim_id, month, encrypted_amount")
                    .eq("space_id", spaceId)
                    .eq("month", currentMonth),
            ]);

            const parsed: { kind: string; amount: number; share: number }[] = [];
            for (const row of claimRows ?? []) {
                if (row.published_by === userId) continue;
                const recorded = (monthRows ?? []).find(m => m.claim_id === row.id);
                const amountText = recorded?.encrypted_amount
                    ? await decryptFor(scope, recorded.encrypted_amount)
                    : row.encrypted_amount
                        ? await decryptFor(scope, row.encrypted_amount)
                        : null;
                const shareText = row.encrypted_share_percentage
                    ? await decryptFor(scope, row.encrypted_share_percentage)
                    : null;
                const amount = Number(amountText);
                const share = Number(shareText);
                if (!Number.isFinite(amount) || !Number.isFinite(share)) continue;
                parsed.push({ kind: row.source_kind, amount, share });
            }
            incomingBySpace.set(spaceId, parsed);
        }

        const next: Record<string, CoParentSettlement> = {};

        for (const coParent of coParents) {
            const sharedIncomeSources = decryptedIncSources.filter((s: any) => s.co_parent_id === coParent.id);
            // Shared insurances bill in current FM (date-math), with actual-or-budget fallback.
            const sharedInsuranceSources = decryptedInsSources.filter(
                (s: any) => s.co_parent_id === coParent.id
                    && billsInFinancialMonth(s, currentMonth, financialMonthStart),
            );
            const sharedExpenses = decryptedExpenses.filter(r => r.co_parent_id === coParent.id);

            // Amount from the month's snapshot/actual, falling back to source.budget;
            // share % is the source's (the snapshot doesn't carry it).
            let incomeReceived = 0;
            let yourShareOfIncome = 0;
            sharedIncomeSources.forEach((source: any) => {
                const monthly = decryptedMonthlyInc.find((m: any) => m.income_source_id === source.id);
                const amount = parseFloat(
                    ((monthly?.actual_amount ?? monthly?.budget_snapshot ?? source.budget) || 0).toString(),
                );
                const sharePercentage = parseFloat((source.share_percentage || 0).toString());
                incomeReceived += amount;
                yourShareOfIncome += amount * sharePercentage / 100;
            });

            let insurancePaid = 0;
            let theirShareOfInsurance = 0;
            sharedInsuranceSources.forEach((source: any) => {
                const monthly = decryptedMonthlyIns.find((m: any) => m.insurance_id === source.id);
                const amount = parseFloat(
                    ((monthly?.actual_amount ?? monthly?.budget_snapshot ?? source.budget) || 0).toString(),
                );
                // share_percentage is YOUR share — the form reads "You pay X%,
                // they pay 100-X%" — so theirs is the remainder.
                const yourShare = parseFloat((source.share_percentage || 0).toString());
                insurancePaid += amount;
                theirShareOfInsurance += amount * (100 - yourShare) / 100;
            });

            // One-off costs you paid and split. Their part is owed to you, exactly
            // like an insurance you paid.
            let oneOffsYouPaid = 0;
            let theirShareOfOneOffs = 0;
            const oneOffsForCoParent = decryptedOneOffs.filter(
                (r: SharedOneOffRow) => r.co_parent_id === coParent.id,
            );
            for (const row of oneOffsForCoParent) {
                const amount = Number(row.actual_amount ?? row.budget_snapshot ?? 0);
                const yourShare = Number(row.share_percentage ?? 50);
                if (!Number.isFinite(amount) || !Number.isFinite(yourShare)) continue;
                oneOffsYouPaid += amount;
                theirShareOfOneOffs += amount * (100 - yourShare) / 100;
            }

            let expensesYouPaid = 0;
            let expensesTheyPaid = 0;
            sharedExpenses.forEach((exp) => {
                const amount = parseFloat((exp.amount || 0).toString());
                if (exp.paid_by === "user") expensesYouPaid += amount;
                else expensesTheyPaid += amount;
            });

            const incoming = coParent.space_id ? incomingBySpace.get(coParent.space_id) ?? [] : [];
            let theirCostsYourShare = 0;
            let theirIncomeYourShare = 0;
            for (const claim of incoming) {
                // share is the publisher's own percentage; ours is the rest.
                const ourPart = claim.amount * (100 - claim.share) / 100;
                if (claim.kind === "income") theirIncomeYourShare += ourPart;
                else theirCostsYourShare += ourPart;
            }

            const amountOwedFromIncome = incomeReceived - yourShareOfIncome;

            // Positive means you owe them. You paid the insurance, so their
            // share is owed to you and comes off what you owe — the same way
            // an expense you paid does, immediately below.
            const netAmount =
                amountOwedFromIncome
                - theirShareOfInsurance
                + (expensesTheyPaid / 2)
                - (expensesYouPaid / 2)
                - theirShareOfOneOffs
                + theirCostsYourShare
                - theirIncomeYourShare;

            next[coParent.id] = {
                incomeReceived,
                yourShareOfIncome,
                insurancePaid,
                theirShareOfInsurance,
                expensesYouPaid,
                expensesTheyPaid,
                oneOffsYouPaid,
                theirShareOfOneOffs,
                theirCostsYourShare,
                theirIncomeYourShare,
                isTwoSided: incoming.length > 0,
                netAmount,
            };
        }

        setSettlements(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [householdId, coParents, userId, financialMonthStart, decryptFor, hasScopeKey]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { settlements, refetch };
}
