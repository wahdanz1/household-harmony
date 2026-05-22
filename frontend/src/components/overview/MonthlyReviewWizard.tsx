import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MoneyInput } from "@/components/ui/money-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, ClipboardCheck, ShieldCheck, Sparkles, Hourglass } from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { RowItem } from "@/components/ui/row-item";
import { StepIndicator } from "@/components/ui/step-indicator";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth, getPreviousFinancialMonth } from "@/utils/dateUtils";
import { ImportStatementStep } from "./ImportStatementStep";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields, expenseFields, monthlyExpenseFields, subscriptionFields, monthlySubscriptionFields, insuranceFields, monthlyInsuranceFields } from "@/hooks/useEncryptedFields";
import { getCategoryById } from "@/constants/expenseCategories";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { billsInFinancialMonth } from "@/utils/billingEvents";
import { reportFailure, reportSuccess, isDown } from "@/utils/outageMonitor";

type ReviewScope = "income" | "expenses";
interface ReviewStatusRow {
    user_id: string;
    scope: ReviewScope;
    accepted_at: string;
}
interface FinalizedRow {
    finalized_by: string;
    finalized_at: string;
}

interface MonthlyReviewWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

interface AuditFields {
    /** Decrypted previous budget snapshot, if mid-month change recorded. */
    previousBudgetSnapshot?: number;
    /** ISO timestamp when source.budget was last edited mid-month. */
    budgetChangedAt?: string;
    /** ISO timestamp when actual_amount was filled outside Review. */
    actualRecordedAt?: string;
    /** Decrypted actual amount, when present. */
    actualAmount?: number;
    /** ISO timestamp when source was inactivated mid-month. */
    inactivatedAt?: string;
}

const VerifiedTag = () => (
    <Check className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={2.6} aria-label="Verified" />
);

interface IncomeItem extends AuditFields {
    id: string;
    name: string;
    amount: number;
    budget: number;
    category?: string;
    source_id: string;
    owner_id: string;
    isMine: boolean;
}

interface ExpenseItem extends AuditFields {
    id: string;
    name: string;
    amount: number;
    budget: number;
    category?: string;
    expense_id: string;
}

interface RecurringItem extends AuditFields {
    /** monthly_* row id, or `new-{source.id}` placeholder when no row exists yet. */
    id: string;
    name: string;
    amount: number;
    budget: number;
    category?: string;
    source_id: string;
    billing_cycle: string;
}

export const MonthlyReviewWizard = ({
    open,
    onOpenChange,
    onComplete,
}: MonthlyReviewWizardProps) => {
    const { user } = useAuth();
    const { household, members } = useHousehold();
    const creditEnabled = !!household?.enable_credit_cards;
    type StepName = "credit" | "income" | "expenses" | "review";
    const stepOrder = useMemo<StepName[]>(
        () => (creditEnabled
            ? ["credit", "income", "expenses", "review"]
            : ["income", "expenses", "review"]),
        [creditEnabled],
    );
    const [currentStep, setCurrentStep] = useState<StepName>(stepOrder[0]);
    // First fetch after open has completed — gates the smart-landing effect.
    const [loaded, setLoaded] = useState(false);
    // Ensures we only auto-land on the right step once per open session.
    const hasLandedRef = useRef(false);
    const [incomes, setIncomes] = useState<IncomeItem[]>([]);
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [subs, setSubs] = useState<RecurringItem[]>([]);
    const [ins, setIns] = useState<RecurringItem[]>([]);
    /** Stable monthly rows that will be auto-accepted on Accept Outflow.
     *  Tracked for the footer counter. */
    const [autoAcceptedCount, setAutoAcceptedCount] = useState(0);
    /** Active non-monthly sources with no billing event this FM (skipped). */
    const [notDueCount, setNotDueCount] = useState(0);
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [reviewStatus, setReviewStatus] = useState<ReviewStatusRow[]>([]);
    const [finalizedRow, setFinalizedRow] = useState<FinalizedRow | null>(null);
    const [savingScope, setSavingScope] = useState<ReviewScope | "finalized" | null>(null);
    // Income rows can flip CatIcon ↔ owner avatar. Hover handles desktop; tap
    // toggles for touch devices that have no hover.
    const [flippedRows, setFlippedRows] = useState<Set<string>>(new Set());
    const toggleFlip = (sourceId: string) => {
        setFlippedRows(prev => {
            const next = new Set(prev);
            if (next.has(sourceId)) next.delete(sourceId);
            else next.add(sourceId);
            return next;
        });
    };

    const handleRevertBudget = async (item: IncomeItem | ExpenseItem, kind: "income" | "expense") => {
        if (item.previousBudgetSnapshot == null) return;
        const isIncome = kind === "income";
        const encrypted = (isIncome
            ? await encryptIncomeSource({ budget: item.previousBudgetSnapshot })
            : await encryptExpenseSource({ budget: item.previousBudgetSnapshot })) as { encrypted_budget: string | null };
        const sourceId = isIncome ? (item as IncomeItem).source_id : (item as ExpenseItem).expense_id;
        // Update source — the trigger fires and rolls the snapshot back too.
        if (isIncome) {
            await supabase.from("income_sources")
                .update({ encrypted_budget: encrypted.encrypted_budget })
                .eq("id", sourceId);
            await supabase.from("monthly_incomes")
                .update({
                    encrypted_previous_budget_snapshot: null,
                    budget_changed_at: null,
                })
                .eq("id", item.id);
        } else {
            await supabase.from("expenses")
                .update({ encrypted_budget: encrypted.encrypted_budget })
                .eq("id", sourceId);
            await supabase.from("monthly_expenses")
                .update({
                    encrypted_previous_budget_snapshot: null,
                    budget_changed_at: null,
                })
                .eq("id", item.id);
        }
        fetchData();
    };

    const handleClearRecorded = async (item: IncomeItem | ExpenseItem, kind: "income" | "expense") => {
        if (kind === "income") {
            await supabase.from("monthly_incomes")
                .update({ encrypted_actual_amount: null, actual_recorded_at: null })
                .eq("id", item.id);
        } else {
            await supabase.from("monthly_expenses")
                .update({ encrypted_actual_amount: null, actual_recorded_at: null })
                .eq("id", item.id);
        }
        fetchData();
    };

    const renderAuditBadges = (item: IncomeItem | ExpenseItem, kind: "income" | "expense", currencyCode: string) => {
        const hasAny = (item.previousBudgetSnapshot != null && item.budgetChangedAt)
            || (item.actualRecordedAt && item.actualAmount != null)
            || item.inactivatedAt;
        if (!hasAny) return null;
        return (
            <div className="flex flex-wrap gap-1 mt-0.5">
                {item.previousBudgetSnapshot != null && item.budgetChangedAt && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRevertBudget(item, kind); }}
                        className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-warn/10 text-warn hover:bg-warn/20"
                        title="Tap to revert"
                    >
                        Changed {format(new Date(item.budgetChangedAt), "d MMM")} · was {Math.round(item.previousBudgetSnapshot).toLocaleString("sv-SE")} {currencyCode}
                    </button>
                )}
                {item.actualRecordedAt && item.actualAmount != null && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleClearRecorded(item, kind); }}
                        className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20"
                        title="Tap to clear"
                    >
                        Recorded {format(new Date(item.actualRecordedAt), "d MMM")} · {Math.round(item.actualAmount).toLocaleString("sv-SE")} {currencyCode}
                    </button>
                )}
                {item.inactivatedAt && (
                    <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                        Inactivated {format(new Date(item.inactivatedAt), "d MMM")}
                    </span>
                )}
            </div>
        );
    };

    const financialMonthStart = household?.financial_month_start || 25;
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);
    // Memoize the Date range — without this, monthStart/monthEnd are new
    // references on every render, which makes any useCallback/useEffect that
    // depends on them re-fire on every render and triggers an infinite refetch
    // loop (5 queries × however many renders/sec).
    const { start: monthStart, end: monthEnd } = useMemo(
        () => getFinancialMonthRange(currentMonth, financialMonthStart),
        [currentMonth, financialMonthStart]
    );
    const previousMonth = useMemo(
        () => getPreviousFinancialMonth(currentMonth, financialMonthStart),
        [currentMonth, financialMonthStart]
    );
    const { start: prevMonthStart, end: prevMonthEnd } = useMemo(
        () => getFinancialMonthRange(previousMonth, financialMonthStart),
        [previousMonth, financialMonthStart]
    );
    const currency = household?.currency || "SEK";

    const { decryptRecords: decryptIncomeSources, encryptRecord: encryptIncomeSource } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptMonthlyIncomes, encryptRecord: encryptMonthlyIncome } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptExpenses, encryptRecord: encryptExpenseSource } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(monthlyExpenseFields);
    const { decryptRecords: decryptSubscriptions } = useEncryptedFields(subscriptionFields);
    const { decryptRecords: decryptMonthlySubscriptions, encryptRecord: encryptMonthlySubscription } = useEncryptedFields(monthlySubscriptionFields);
    const { decryptRecords: decryptInsurances } = useEncryptedFields(insuranceFields);
    const { decryptRecords: decryptMonthlyInsurances, encryptRecord: encryptMonthlyInsurance } = useEncryptedFields(monthlyInsuranceFields);

    // Latest decrypt fns in a ref so polling closure doesn't go stale
    const decryptRefs = useRef({ decryptMonthlyIncomes, decryptMonthlyExpenses, decryptMonthlySubscriptions, decryptMonthlyInsurances });
    decryptRefs.current = { decryptMonthlyIncomes, decryptMonthlyExpenses, decryptMonthlySubscriptions, decryptMonthlyInsurances };

    const fetchData = useCallback(async () => {
        if (!household || !user) return;

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        let results;
        try {
            results = await Promise.all([
                supabase.from("income_sources").select("*").eq("household_id", household.id).eq("is_active", true).is("archived_at", null),
                supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
                // is_credit expenses are reviewed via the Credit tab's PDF flow, not here.
                supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).is("archived_at", null).not("is_credit", "is", true).order("sort_order"),
                supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
                supabase.from("monthly_review_status").select("user_id, scope, accepted_at").eq("household_id", household.id).eq("month", currentMonth),
                supabase.from("monthly_review_finalized").select("finalized_by, finalized_at").eq("household_id", household.id).eq("month", currentMonth).maybeSingle(),
                // Include archived/inactive sources so monthly_* rows that pre-date a deactivation still resolve names.
                supabase.from("subscriptions").select("*").eq("household_id", household.id),
                supabase.from("monthly_subscriptions").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
                supabase.from("insurances").select("*").eq("household_id", household.id),
                supabase.from("monthly_insurances").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
            ]);
        } catch (err) {
            reportFailure(err);
            return;
        }

        const firstError = results.find(r => r.error)?.error;
        if (firstError) {
            reportFailure(firstError);
            return;
        }
        reportSuccess();

        const [
            { data: sourcesData },
            { data: monthlyIncomesData },
            { data: categoriesData },
            { data: monthlyExpensesData },
            { data: statusData },
            { data: finalizedData },
            { data: subsSourceData },
            { data: monthlySubsData },
            { data: insSourceData },
            { data: monthlyInsData },
        ] = results;

        const decryptedSources = await decryptIncomeSources(sourcesData || []);
        const decryptedMonthlyIncomes = await decryptRefs.current.decryptMonthlyIncomes(monthlyIncomesData || []);
        const decryptedCategories = await decryptExpenses(categoriesData || []);
        const decryptedMonthlyExpenses = await decryptRefs.current.decryptMonthlyExpenses(monthlyExpensesData || []);
        const decryptedSubsSources = await decryptSubscriptions(subsSourceData || []);
        const decryptedMonthlySubs = await decryptRefs.current.decryptMonthlySubscriptions(monthlySubsData || []);
        const decryptedInsSources = await decryptInsurances(insSourceData || []);
        const decryptedMonthlyIns = await decryptRefs.current.decryptMonthlyInsurances(monthlyInsData || []);

        const resolveAmount = (
            existing: any | undefined,
            staticDefault: any
        ): number => {
            if (existing) {
                const v = existing.actual_amount ?? existing.budget_snapshot ?? 0;
                return parseFloat(v.toString());
            }
            return parseFloat((staticDefault || "0").toString());
        };

        const auditOf = (monthly: any): AuditFields => ({
            previousBudgetSnapshot: monthly?.previous_budget_snapshot != null
                ? Number(monthly.previous_budget_snapshot) : undefined,
            budgetChangedAt: monthly?.budget_changed_at ?? undefined,
            actualRecordedAt: monthly?.actual_recorded_at ?? undefined,
            actualAmount: monthly?.actual_amount != null
                ? Number(monthly.actual_amount) : undefined,
            inactivatedAt: monthly?.inactivated_at ?? undefined,
        });

        const incomeItems: IncomeItem[] = decryptedSources.map((source: any) => {
            const monthlyRecord = decryptedMonthlyIncomes.find((m: any) => m.income_source_id === source.id);
            const amount = resolveAmount(monthlyRecord, source.budget);
            return {
                id: monthlyRecord?.id || `new-${source.id}`,
                name: source.name || source.provider,
                amount,
                budget: source.budget ?? 0,
                category: source.category,
                source_id: source.id,
                owner_id: source.owner_id,
                isMine: source.owner_id === user.id,
                ...auditOf(monthlyRecord),
            };
        });

        const expenseItems: ExpenseItem[] = decryptedCategories.map((category: any) => {
            const monthlyRecord = decryptedMonthlyExpenses.find((m: any) => m.expense_id === category.id);
            const amount = resolveAmount(monthlyRecord, category.budget);
            return {
                id: monthlyRecord?.id || `new-${category.id}`,
                name: category.name,
                amount,
                budget: category.budget ?? 0,
                category: category.category,
                expense_id: category.id,
                ...auditOf(monthlyRecord),
            };
        });

        // Build recurring items (subs + insurances) under lazy semantics:
        // iterate active sources, include those whose billing falls in the
        // current FM (via date-math). monthly_* rows are used for audit
        // data when present; otherwise the source's current budget is the
        // snapshot. Rows are upserted on Accept.
        const buildRecurring = (
            sources: any[],
            monthlyRows: any[],
            fkField: "subscription_id" | "insurance_id",
            nameOf: (s: any) => string,
        ): RecurringItem[] => {
            return sources
                .filter((s: any) => s.is_active && !s.archived_at)
                .filter((s: any) => billsInFinancialMonth(s, currentMonth, financialMonthStart))
                .map((source: any) => {
                    const monthly = monthlyRows.find((m: any) => m[fkField] === source.id);
                    const amount = monthly?.actual_amount ?? monthly?.budget_snapshot ?? source.budget ?? 0;
                    return {
                        id: monthly?.id || `new-${source.id}`,
                        name: nameOf(source),
                        amount: parseFloat(amount.toString()),
                        budget: parseFloat((source.budget ?? 0).toString()),
                        category: source.category,
                        source_id: source.id,
                        billing_cycle: source.billing_cycle,
                        ...auditOf(monthly),
                    };
                });
        };

        const subItems = buildRecurring(
            decryptedSubsSources,
            decryptedMonthlySubs,
            "subscription_id",
            (s) => s.name || s.service || "Subscription",
        );
        const insItems = buildRecurring(
            decryptedInsSources,
            decryptedMonthlyIns,
            "insurance_id",
            (s) => {
                const rawName = typeof s.name === "string" ? s.name.trim() : "";
                if (rawName && rawName !== "NaN") return rawName;
                return insuranceTypes.find(t => t.value === s.category)?.label ?? "Insurance";
            },
        );

        // Smart-show: only surface rows that need attention. Stable monthly
        // rows get auto-accepted on Accept Outflow with actual = budget_snapshot.
        const isNoteworthy = (r: RecurringItem) =>
            r.billing_cycle !== 'monthly' ||
            r.previousBudgetSnapshot != null ||
            r.inactivatedAt != null;
        const noteworthySubsCount = subItems.filter(isNoteworthy).length;
        const noteworthyInsCount = insItems.filter(isNoteworthy).length;
        const stableCount = (subItems.length - noteworthySubsCount) + (insItems.length - noteworthyInsCount);

        // Non-monthly sources with no billing event this FM are skipped
        // entirely (not shown, not auto-accepted). Count them so the footer
        // can account for every active source — nothing vanishes silently.
        const billedSubIds = new Set(subItems.map(i => i.source_id));
        const billedInsIds = new Set(insItems.map(i => i.source_id));
        const notDueCount =
            decryptedSubsSources.filter((s: any) => s.is_active && !s.archived_at && s.billing_cycle !== 'monthly' && !billedSubIds.has(s.id)).length +
            decryptedInsSources.filter((s: any) => s.is_active && !s.archived_at && s.billing_cycle !== 'monthly' && !billedInsIds.has(s.id)).length;

        setIncomes(incomeItems);
        setExpenses(expenseItems);
        setSubs(subItems);
        setIns(insItems);
        setAutoAcceptedCount(stableCount);
        setNotDueCount(notDueCount);
        setReviewStatus((statusData as ReviewStatusRow[]) || []);
        setFinalizedRow((finalizedData as FinalizedRow | null) ?? null);

        setAmounts(prev => {
            const next: Record<string, string> = { ...prev };
            // Only seed amounts for keys we don't have yet — never overwrite
            // a value the user is currently typing.
            incomeItems.forEach(item => {
                const key = `income-${item.source_id}`;
                if (next[key] === undefined) next[key] = item.amount.toString();
            });
            expenseItems.forEach(item => {
                const key = `expense-${item.expense_id}`;
                if (next[key] === undefined) next[key] = item.amount.toString();
            });
            subItems.filter(isNoteworthy).forEach(item => {
                const key = `sub-${item.source_id}`;
                if (next[key] === undefined) next[key] = item.amount.toString();
            });
            insItems.filter(isNoteworthy).forEach(item => {
                const key = `ins-${item.source_id}`;
                if (next[key] === undefined) next[key] = item.amount.toString();
            });
            return next;
        });
        setLoaded(true);
    }, [household, user, monthStart, monthEnd, currentMonth, decryptIncomeSources, decryptExpenses, decryptSubscriptions, decryptInsurances]);

    // Reset transient UI state ONLY when the wizard transitions to open.
    // Step landing is deferred to the smart-landing effect below (which waits
    // for the first fetch so it can pick the right step based on progress).
    // Don't include `user` or `household` here — those refs can change (e.g.
    // when the tab regains focus and Supabase refreshes the auth session),
    // and resetting amounts would briefly flash all inputs to 0 before the
    // refetch repopulates them.
    useEffect(() => {
        if (open) {
            hasLandedRef.current = false;
            setLoaded(false);
            setFlippedRows(new Set());
        }
    }, [open]);

    // Refetch data when wizard opens or when its inputs (household/user)
    // legitimately change. fetchData itself is memoized; setAmounts inside
    // it only seeds keys that don't exist yet, so user-typed values survive.
    useEffect(() => {
        if (open && user && household) {
            fetchData();
        }
    }, [open, user, household, fetchData]);

    // No background polling — refetch only when the wizard regains focus
    // (user came back to this tab) or when the user explicitly clicks the
    // refresh button. Cross-device "live" updates aren't worth the request
    // overhead for a 2-person household; manual refresh covers the rare case
    // of "Sarah just told me she's done, let me re-check".
    useEffect(() => {
        if (!open) return;

        const onVisibilityChange = () => {
            if (!document.hidden && !isDown()) fetchData();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [open, fetchData]);

    const handleAmountChange = (key: string, value: string) => {
        setAmounts(prev => ({ ...prev, [key]: value }));
    };

    const writeStatus = async (scope: ReviewScope, userIds?: string[]) => {
        if (!household || !user) return;
        const ids = userIds && userIds.length > 0 ? userIds : [user.id];
        const rows = ids.map(uid => ({
            household_id: household.id,
            user_id: uid,
            month: currentMonth,
            scope,
            accepted_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("monthly_review_status").upsert(rows, {
            onConflict: "household_id,user_id,month,scope",
        });
        if (error) throw error;
    };

    const acceptIncome = async () => {
        if (!household || !user) return;
        setSavingScope("income");

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        try {
            // One-does-it-all: the reviewer confirms every member's income in
            // one pass. RLS lets a household member write monthly_incomes +
            // status rows on anyone's behalf (see migration 20260508130918).
            for (const income of incomes) {
                const amount = parseFloat(amounts[`income-${income.source_id}`] || "0");
                const baseData = {
                    household_id: household.id,
                    income_source_id: income.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    actual_amount: amount,
                    created_by: income.owner_id,
                };
                const data = await encryptMonthlyIncome(baseData);
                const { error } = await supabase.from("monthly_incomes").upsert(data, {
                    onConflict: "income_source_id,month",
                });
                if (error) throw error;
            }

            // One pass confirms income for the whole household, so mark every
            // member accepted (covers members who have no income source of
            // their own — otherwise finalize would stay blocked on them).
            const acceptedUserIds = Array.from(new Set([user.id, ...members.map(m => m.user_id)]));
            await writeStatus("income", acceptedUserIds);

            toast.success("Income confirmed");
            await fetchData();
            setCurrentStep("expenses");
        } catch (error: any) {
            console.error("Error saving income:", error);
            toast.error(error.message || "Failed to save income");
        } finally {
            setSavingScope(null);
        }
    };

    const verifyExpenses = async () => {
        if (!household || !user) return;
        setSavingScope("expenses");

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        try {
            for (const expense of expenses) {
                const amount = parseFloat(amounts[`expense-${expense.expense_id}`] || "0");
                const baseData = {
                    household_id: household.id,
                    expense_id: expense.expense_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    actual_amount: amount,
                    created_by: user.id,
                };
                const data = await encryptMonthlyExpense(baseData);
                const { error } = await supabase.from("monthly_expenses").upsert(data, {
                    onConflict: "expense_id,month",
                });
                if (error) throw error;
            }

            // Noteworthy subs + insurances: write user-entered actuals.
            // Stable monthly ones: auto-accept with actual = budget_snapshot.
            const nowIso = new Date().toISOString();
            for (const item of subs) {
                const noteworthy = isNoteworthyRecurring(item);
                const amount = noteworthy
                    ? parseFloat(amounts[`sub-${item.source_id}`] || "0")
                    : item.budget;
                const baseData = {
                    household_id: household.id,
                    subscription_id: item.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    actual_amount: amount,
                    actual_recorded_at: noteworthy ? null : nowIso,
                    created_by: user.id,
                };
                const data = await encryptMonthlySubscription(baseData);
                const { error } = await supabase.from("monthly_subscriptions").upsert(data, {
                    onConflict: "subscription_id,month",
                });
                if (error) throw error;
            }
            for (const item of ins) {
                const noteworthy = isNoteworthyRecurring(item);
                const amount = noteworthy
                    ? parseFloat(amounts[`ins-${item.source_id}`] || "0")
                    : item.budget;
                const baseData = {
                    household_id: household.id,
                    insurance_id: item.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    actual_amount: amount,
                    actual_recorded_at: noteworthy ? null : nowIso,
                    created_by: user.id,
                };
                const data = await encryptMonthlyInsurance(baseData);
                const { error } = await supabase.from("monthly_insurances").upsert(data, {
                    onConflict: "insurance_id,month",
                });
                if (error) throw error;
            }

            await writeStatus("expenses");

            toast.success("Outflow verified");
            await fetchData();
        } catch (error: any) {
            console.error("Error saving outflow:", error);
            toast.error(error.message || "Failed to save outflow");
        } finally {
            setSavingScope(null);
        }
    };

    const finalize = async () => {
        if (!household || !user) return;
        setSavingScope("finalized");
        try {
            const { error } = await supabase.from("monthly_review_finalized").upsert({
                household_id: household.id,
                month: currentMonth,
                finalized_by: user.id,
                finalized_at: new Date().toISOString(),
            }, { onConflict: "household_id,month" });
            if (error) throw error;
            toast.success("Review finalized");
            onComplete();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error finalizing:", error);
            toast.error(error.message || "Failed to finalize");
        } finally {
            setSavingScope(null);
        }
    };

    const incomeAcceptedUserIds = new Set(reviewStatus.filter(r => r.scope === "income").map(r => r.user_id));
    const expensesVerified = reviewStatus.some(r => r.scope === "expenses");
    const isFinalized = !!finalizedRow;
    const myIncomeAccepted = incomeAcceptedUserIds.has(user?.id || "");
    const allMembersAcceptedIncome = members.length > 0 && members.every(m => incomeAcceptedUserIds.has(m.user_id));
    const canFinalize = allMembersAcceptedIncome && expensesVerified && !isFinalized;

    // Smart landing: once the first fetch resolves, drop the user on the step
    // that matches how far the review already is — no point re-walking Upload
    // → Income → Outflow when those are already done. Runs once per open.
    useEffect(() => {
        if (!open || !loaded || hasLandedRef.current) return;
        const landing: StepName =
            isFinalized || (allMembersAcceptedIncome && expensesVerified) ? "review"
            : allMembersAcceptedIncome ? "expenses"
            : stepOrder[0];
        setCurrentStep(landing);
        hasLandedRef.current = true;
    }, [open, loaded, isFinalized, allMembersAcceptedIncome, expensesVerified, stepOrder]);
    const finalizerName = isFinalized
        ? members.find(m => m.user_id === finalizedRow!.finalized_by)?.profiles?.full_name || "A household member"
        : null;
    const myIncomeAcceptedAt = reviewStatus.find(r => r.scope === "income" && r.user_id === user?.id)?.accepted_at;
    const expensesVerifiedAt = reviewStatus.find(r => r.scope === "expenses")?.accepted_at;

    // Dirty = any income value differs from what's persisted in item.amount.
    const incomeDirty = useMemo(() => {
        for (const item of incomes) {
            const v = parseFloat(amounts[`income-${item.source_id}`] || "0");
            if (Math.abs(v - item.amount) > 0.01) return true;
        }
        return false;
    }, [incomes, amounts]);

    const expensesDirty = useMemo(() => {
        for (const item of expenses) {
            const v = parseFloat(amounts[`expense-${item.expense_id}`] || "0");
            if (Math.abs(v - item.amount) > 0.01) return true;
        }
        return false;
    }, [expenses, amounts]);

    const steps = stepOrder.map((s) => ({
        label: s === "credit" ? "Upload"
            : s === "income" ? "Income"
            : s === "expenses" ? "Outflow"
            : "Review",
    }));

    const isNoteworthyRecurring = (r: RecurringItem) =>
        r.billing_cycle !== 'monthly' ||
        r.previousBudgetSnapshot != null ||
        r.inactivatedAt != null;
    const noteworthySubs = subs.filter(isNoteworthyRecurring);
    const noteworthyIns = ins.filter(isNoteworthyRecurring);
    const currentIdx = Math.max(0, stepOrder.indexOf(currentStep));
    // Free roam — every step is reachable. The only gated action is Finalize
    // (disabled with a reason on the Review step until income + outflow done).
    const jumpToIdx = (idx: number) => {
        setCurrentStep(stepOrder[idx]);
    };

    const renderVariance = (current: number, planned: number, kind: "income" | "expense") => {
        const variance = current - planned;
        if (Math.abs(variance) < 0.5 || planned === 0) return null;
        const over = variance > 0;
        const good = kind === "income" ? over : !over;
        return (
            <span
                className={`text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${good ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                    }`}
                title={`Planned ${Math.round(planned).toLocaleString("sv-SE")} ${currency}`}
            >
                {over ? "+" : "−"}{Math.abs(Math.round(variance)).toLocaleString("sv-SE")} {currency}
            </span>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-accent" /> Monthly Review
                    </DialogTitle>
                    <DialogDescription>
                        {formatFinancialMonth(currentMonth, financialMonthStart)}
                    </DialogDescription>
                </DialogHeader>

                {isFinalized && (
                    <Alert variant="success">
                        <ShieldCheck />
                        <AlertContent>
                            <AlertTitle>Review finalized</AlertTitle>
                            <AlertDescription>
                                Finalized by {finalizerName} on {format(new Date(finalizedRow!.finalized_at), "MMM d, HH:mm")}.
                                Use the Income or Expenses page to make corrections.
                            </AlertDescription>
                        </AlertContent>
                    </Alert>
                )}

                {!isFinalized && (
                    <StepIndicator
                        steps={steps}
                        current={currentIdx}
                        onJump={jumpToIdx}
                        freeNav={true}
                        className="px-1"
                    />
                )}

                <div className="flex-1 overflow-y-auto -mx-2 px-2">
                    {currentStep === "credit" && household && (
                        <ImportStatementStep
                            householdId={household.id}
                            currency={currency}
                            monthStart={prevMonthStart}
                            monthEnd={prevMonthEnd}
                            onImported={() => setCurrentStep("income")}
                        />
                    )}

                    {currentStep === "income" && (
                        <div className="rounded-xl border border-line bg-surface overflow-hidden">
                            {incomes.length === 0 ? (
                                <p className="text-sm text-muted text-center py-8 px-4">
                                    No income sources configured for this household.
                                </p>
                            ) : (
                                incomes.map((item, idx) => {
                                    const ownerMember = members.find(m => m.user_id === item.owner_id);
                                    const ownerName = ownerMember?.profiles?.full_name || (item.isMine ? "You" : "Other member");
                                    const ownerInitials = ownerName.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                                    const editable = !isFinalized;
                                    const ownerAccepted = incomeAcceptedUserIds.has(item.owner_id);
                                    const isFlipped = flippedRows.has(item.source_id);
                                    const incCat = item.category ? getIncomeCategoryById(item.category) : undefined;
                                    const IncCatIcon = incCat?.icon || Sparkles;
                                    const currentValue = parseFloat(amounts[`income-${item.source_id}`] || "0");
                                    return (
                                        <RowItem
                                            key={item.source_id}
                                            last={idx === incomes.length - 1}
                                            className={`group/row relative ${ownerAccepted ? "before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent" : ""}`}
                                            onClick={() => toggleFlip(item.source_id)}
                                        >
                                            <div
                                                className="shrink-0 [perspective:600px]"
                                                title={isFlipped ? "Tap to show category" : `Tap to show ${ownerName}`}
                                            >
                                                <div
                                                    className={`relative h-9 w-9 transition-transform duration-300 [transform-style:preserve-3d] group-hover/row:[transform:rotateY(180deg)] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
                                                >
                                                    <div className="absolute inset-0 [backface-visibility:hidden]">
                                                        <CatIcon icon={IncCatIcon} hue={incCat?.hue} size={36} />
                                                    </div>
                                                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                                        <Avatar className="h-9 w-9">
                                                            {ownerMember?.profiles?.avatar_url && (
                                                                <AvatarImage src={ownerMember.profiles.avatar_url} alt={ownerName} />
                                                            )}
                                                            <AvatarFallback className="text-[11px] font-medium">{ownerInitials}</AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
                                                    {ownerAccepted && <VerifiedTag />}
                                                </div>
                                                {renderAuditBadges(item, "income", currency)}
                                            </div>
                                            <div className="shrink-0 flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                <MoneyInput
                                                    value={currentValue}
                                                    currency={currency}
                                                    disabled={!editable}
                                                    status={Math.abs(currentValue - item.budget) < 0.01 ? "saved" : "modified"}
                                                    onChange={(v) => handleAmountChange(`income-${item.source_id}`, v.toString())}
                                                    widthClassName="w-24"
                                                />
                                                {renderVariance(currentValue, item.budget, "income")}
                                            </div>
                                        </RowItem>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {currentStep === "expenses" && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-line bg-surface overflow-hidden">
                                {expenses.length === 0 ? (
                                    <p className="text-sm text-muted text-center py-8 px-4">
                                        No expenses configured for this household.
                                    </p>
                                ) : (
                                    expenses.map((item, idx) => {
                                        const cat = item.category ? getCategoryById(item.category) : null;
                                        const Icon = cat?.icon || Sparkles;
                                        const currentValue = parseFloat(amounts[`expense-${item.expense_id}`] || "0");
                                        return (
                                            <RowItem
                                                key={item.expense_id}
                                                last={idx === expenses.length - 1}
                                                className={`relative ${expensesVerified ? "before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent" : ""}`}
                                            >
                                                <CatIcon icon={Icon} hue={cat?.hue} size={36} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
                                                        {expensesVerified && <VerifiedTag />}
                                                    </div>
                                                    {renderAuditBadges(item, "expense", currency)}
                                                </div>
                                                <div className="shrink-0 flex flex-col items-end gap-1">
                                                    <MoneyInput
                                                        value={currentValue}
                                                        currency={currency}
                                                        disabled={isFinalized}
                                                        status={Math.abs(currentValue - item.budget) < 0.01 ? "saved" : "modified"}
                                                        onChange={(v) => handleAmountChange(`expense-${item.expense_id}`, v.toString())}
                                                        widthClassName="w-24"
                                                    />
                                                    {renderVariance(currentValue, item.budget, "expense")}
                                                </div>
                                            </RowItem>
                                        );
                                    })
                                )}
                            </div>

                            {noteworthySubs.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-medium text-muted px-1 mb-1.5">Subscriptions</h4>
                                    <div className="rounded-xl border border-line bg-surface overflow-hidden">
                                        {noteworthySubs.map((item, idx) => {
                                            const cat = subscriptionCategories.find(c => c.value === item.category);
                                            const Icon = cat?.icon || Sparkles;
                                            const currentValue = parseFloat(amounts[`sub-${item.source_id}`] || "0");
                                            return (
                                                <RowItem
                                                    key={item.source_id}
                                                    last={idx === noteworthySubs.length - 1}
                                                    className={expensesVerified ? "relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent" : ""}
                                                >
                                                    <CatIcon icon={Icon} hue={cat?.hue} size={36} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
                                                            {expensesVerified && <VerifiedTag />}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {item.previousBudgetSnapshot != null && item.budgetChangedAt && (
                                                                <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-warn/10 text-warn">
                                                                    Changed {format(new Date(item.budgetChangedAt), "d MMM")} · was {Math.round(item.previousBudgetSnapshot).toLocaleString("sv-SE")} {currency}
                                                                </span>
                                                            )}
                                                            {item.inactivatedAt && (
                                                                <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                                                                    Inactivated {format(new Date(item.inactivatedAt), "d MMM")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                                        <MoneyInput
                                                            value={currentValue}
                                                            currency={currency}
                                                            disabled={isFinalized}
                                                            status={Math.abs(currentValue - item.budget) < 0.01 ? "saved" : "modified"}
                                                            onChange={(v) => handleAmountChange(`sub-${item.source_id}`, v.toString())}
                                                            widthClassName="w-24"
                                                        />
                                                        {renderVariance(currentValue, item.budget, "expense")}
                                                    </div>
                                                </RowItem>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {noteworthyIns.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-medium text-muted px-1 mb-1.5">Insurances</h4>
                                    <div className="rounded-xl border border-line bg-surface overflow-hidden">
                                        {noteworthyIns.map((item, idx) => {
                                            const cat = insuranceTypes.find(c => c.value === item.category);
                                            const Icon = cat?.icon || ShieldCheck;
                                            const currentValue = parseFloat(amounts[`ins-${item.source_id}`] || "0");
                                            return (
                                                <RowItem
                                                    key={item.source_id}
                                                    last={idx === noteworthyIns.length - 1}
                                                    className={expensesVerified ? "relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-accent" : ""}
                                                >
                                                    <CatIcon icon={Icon} hue={cat?.hue} size={36} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
                                                            {expensesVerified && <VerifiedTag />}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {item.previousBudgetSnapshot != null && item.budgetChangedAt && (
                                                                <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-warn/10 text-warn">
                                                                    Changed {format(new Date(item.budgetChangedAt), "d MMM")} · was {Math.round(item.previousBudgetSnapshot).toLocaleString("sv-SE")} {currency}
                                                                </span>
                                                            )}
                                                            {item.inactivatedAt && (
                                                                <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                                                                    Inactivated {format(new Date(item.inactivatedAt), "d MMM")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                                        <MoneyInput
                                                            value={currentValue}
                                                            currency={currency}
                                                            disabled={isFinalized}
                                                            status={Math.abs(currentValue - item.budget) < 0.01 ? "saved" : "modified"}
                                                            onChange={(v) => handleAmountChange(`ins-${item.source_id}`, v.toString())}
                                                            widthClassName="w-24"
                                                        />
                                                        {renderVariance(currentValue, item.budget, "expense")}
                                                    </div>
                                                </RowItem>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {(autoAcceptedCount > 0 || notDueCount > 0) && (
                                <p className="text-xs text-muted text-center pt-1">
                                    {autoAcceptedCount > 0 && (
                                        <>{autoAcceptedCount} monthly item{autoAcceptedCount === 1 ? "" : "s"} auto-accepted at budgeted amount</>
                                    )}
                                    {autoAcceptedCount > 0 && notDueCount > 0 && " · "}
                                    {notDueCount > 0 && (
                                        <>{notDueCount} item{notDueCount === 1 ? "" : "s"} not due this month</>
                                    )}
                                </p>
                            )}
                        </div>
                    )}

                    {currentStep === "review" && (
                        <div className="rounded-xl border border-line bg-surface px-5 py-6 space-y-3">
                            {canFinalize ? (
                                <div className="flex items-start gap-3">
                                    <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                                    <div className="space-y-2 text-sm leading-relaxed">
                                        <p className="text-ink">
                                            You're about to finalize <strong className="font-semibold">{formatFinancialMonth(currentMonth, financialMonthStart)}</strong>.
                                        </p>
                                        <p className="text-muted">
                                            After finalizing, the Income and Expenses pages will switch to this month as their default view. Any further corrections happen on those pages, not in this wizard.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3">
                                    <Hourglass className="h-5 w-5 text-warn shrink-0 mt-0.5" />
                                    <div className="space-y-2 text-sm leading-relaxed">
                                        <p className="text-ink font-medium">Almost there — a couple of things first:</p>
                                        <ul className="text-muted space-y-1">
                                            <li className="flex items-center gap-2">
                                                {allMembersAcceptedIncome
                                                    ? <Check className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={2.6} />
                                                    : <span className="h-3.5 w-3.5 rounded-full border border-line shrink-0" />}
                                                Confirm income
                                            </li>
                                            <li className="flex items-center gap-2">
                                                {expensesVerified
                                                    ? <Check className="h-3.5 w-3.5 text-accent shrink-0" strokeWidth={2.6} />
                                                    : <span className="h-3.5 w-3.5 rounded-full border border-line shrink-0" />}
                                                Verify outflow
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {!isFinalized && (
                    <div className="pt-3 space-y-2">
                        {currentStep === "credit" && (
                            <Button
                                onClick={() => setCurrentStep("income")}
                                className="w-full"
                                size="lg"
                                variant="outline"
                            >
                                Continue to income
                            </Button>
                        )}

                        {currentStep === "income" && (
                            (allMembersAcceptedIncome && !incomeDirty) ? (
                                <div className="space-y-1">
                                    <Button
                                        onClick={() => setCurrentStep("expenses")}
                                        className="w-full"
                                        size="lg"
                                        variant="outline"
                                    >
                                        Continue to outflow
                                    </Button>
                                    <p className="text-center text-[11px] text-muted flex items-center justify-center gap-1.5">
                                        <Check className="h-3 w-3 text-accent" />
                                        Confirmed {myIncomeAcceptedAt ? format(new Date(myIncomeAcceptedAt), "MMM d, HH:mm") : "—"}
                                    </p>
                                </div>
                            ) : (
                                <Button
                                    onClick={acceptIncome}
                                    disabled={savingScope !== null || incomes.length === 0}
                                    className="w-full"
                                    size="lg"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    {savingScope === "income"
                                        ? "Saving..."
                                        : myIncomeAccepted ? "Re-confirm income" : "Confirm income"}
                                </Button>
                            )
                        )}

                        {currentStep === "expenses" && (
                            (expensesVerified && !expensesDirty) ? (
                                <div className="space-y-1">
                                    <Button
                                        onClick={() => setCurrentStep("review")}
                                        className="w-full"
                                        size="lg"
                                        variant="outline"
                                    >
                                        Continue to review
                                    </Button>
                                    <p className="text-center text-[11px] text-muted flex items-center justify-center gap-1.5">
                                        <Check className="h-3 w-3 text-accent" />
                                        Verified {expensesVerifiedAt ? format(new Date(expensesVerifiedAt), "MMM d, HH:mm") : "—"}
                                    </p>
                                </div>
                            ) : (
                                <Button
                                    onClick={verifyExpenses}
                                    disabled={savingScope !== null}
                                    className="w-full"
                                    size="lg"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    {savingScope === "expenses" ? "Saving..." : expensesVerified ? "Re-verify outflow" : "Verify outflow"}
                                </Button>
                            )
                        )}

                        {currentStep === "review" && (
                            <Button
                                onClick={finalize}
                                disabled={!canFinalize || savingScope !== null}
                                className="w-full"
                                size="lg"
                            >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                {savingScope === "finalized" ? "Finalizing..." : "Finalize review"}
                            </Button>
                        )}

                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

/**
 * Banner gating: review is "done" once the month has been finalized.
 * Returns the latest finalized month so consumers (Income/Expenses pages)
 * can decide which month to default to.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMonthlyReviewStatus(householdId: string | undefined, financialMonthStart: number = 25) {
    const [needsReview, setNeedsReview] = useState(false);
    const [latestFinalizedMonth, setLatestFinalizedMonth] = useState<string | null>(null);
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);

    const refresh = useCallback(async () => {
        if (!householdId) {
            setNeedsReview(false);
            setLatestFinalizedMonth(null);
            return;
        }

        const { data } = await supabase
            .from("monthly_review_finalized")
            .select("month")
            .eq("household_id", householdId)
            .order("month", { ascending: false });

        const finalized = (data as { month: string }[]) || [];
        const latest = finalized[0]?.month ?? null;
        setLatestFinalizedMonth(latest);
        setNeedsReview(latest !== currentMonth);
    }, [householdId, currentMonth]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { needsReview, latestFinalizedMonth, markAsReviewed: refresh };
}
