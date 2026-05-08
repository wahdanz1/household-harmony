import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, TrendingDown, Check, ClipboardCheck, Lock, Clock, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields, expenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCategoryById } from "@/constants/expenseCategories";
import { fetchMostRecentByKey } from "@/utils/carryForward";

type ReviewScope = "income" | "expenses" | "finalized";
interface ReviewStatusRow {
    user_id: string;
    scope: ReviewScope;
    accepted_at: string;
}

interface MonthlyReviewWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

interface IncomeItem {
    id: string;
    name: string;
    amount: number;
    defaultAmount: number;
    source_id: string;
    created_by: string;
    isMine: boolean;
}

interface ExpenseItem {
    id: string;
    name: string;
    amount: number;
    defaultAmount: number;
    category?: string;
    expense_id: string;
}

const POLL_INTERVAL_MS = 15000;

export const MonthlyReviewWizard = ({
    open,
    onOpenChange,
    onComplete,
}: MonthlyReviewWizardProps) => {
    const { user } = useAuth();
    const { household, members } = useHousehold();
    const [activeTab, setActiveTab] = useState<"income" | "expenses">("income");
    const [incomes, setIncomes] = useState<IncomeItem[]>([]);
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [reviewStatus, setReviewStatus] = useState<ReviewStatusRow[]>([]);
    const [savingScope, setSavingScope] = useState<ReviewScope | null>(null);
    const [confirmFinalize, setConfirmFinalize] = useState(false);

    const financialMonthStart = household?.financial_month_start || 25;
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);
    const currency = household?.currency || "SEK";

    const { decryptRecords: decryptIncomeSources } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptMonthlyIncomes, encryptRecord: encryptMonthlyIncome } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptExpenses } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(monthlyExpenseFields);

    // Latest decrypt fns in a ref so polling closure doesn't go stale
    const decryptRefs = useRef({ decryptMonthlyIncomes, decryptMonthlyExpenses });
    decryptRefs.current = { decryptMonthlyIncomes, decryptMonthlyExpenses };

    const fetchData = useCallback(async () => {
        if (!household || !user) return;

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        const [
            { data: sourcesData },
            { data: monthlyIncomesData },
            { data: categoriesData },
            { data: monthlyExpensesData },
            { data: statusData },
        ] = await Promise.all([
            supabase.from("income_sources").select("*").eq("household_id", household.id).eq("is_active", true),
            supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
            // is_credit expenses are reviewed via the Credit tab's PDF flow, not here.
            supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).not("is_credit", "is", true).order("sort_order"),
            supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
            supabase.from("monthly_review_status").select("user_id, scope, accepted_at").eq("household_id", household.id).eq("month", currentMonth),
        ]);

        const decryptedSources = await decryptIncomeSources(sourcesData || []);
        const decryptedMonthlyIncomes = await decryptRefs.current.decryptMonthlyIncomes(monthlyIncomesData || []);
        const decryptedCategories = await decryptExpenses(categoriesData || []);
        const decryptedMonthlyExpenses = await decryptRefs.current.decryptMonthlyExpenses(monthlyExpensesData || []);

        // Carry-forward: for sources/categories without a record this month,
        // fall back to most recent prior record (not the static default).
        const sourcesNeedingCarry = decryptedSources.filter(
            (s: any) => !decryptedMonthlyIncomes.find((m: any) => m.income_source_id === s.id)
        );
        const expensesNeedingCarry = decryptedCategories.filter(
            (c: any) => !decryptedMonthlyExpenses.find((m: any) => m.expense_id === c.id)
        );

        const [incomeCarry, expenseCarry] = await Promise.all([
            fetchMostRecentByKey({
                table: "monthly_incomes",
                keyField: "income_source_id",
                keys: sourcesNeedingCarry.map((s: any) => s.id),
                householdId: household.id,
                beforeMonth: currentMonth,
                decrypt: decryptRefs.current.decryptMonthlyIncomes,
            }),
            fetchMostRecentByKey({
                table: "monthly_expenses",
                keyField: "expense_id",
                keys: expensesNeedingCarry.map((c: any) => c.id),
                householdId: household.id,
                beforeMonth: currentMonth,
                decrypt: decryptRefs.current.decryptMonthlyExpenses,
            }),
        ]);

        const resolveAmount = (
            existing: any | undefined,
            carryRecord: any | undefined,
            staticDefault: any
        ): number => {
            if (existing) return parseFloat((existing.amount || "0").toString());
            if (carryRecord) return parseFloat((carryRecord.amount || "0").toString());
            return parseFloat((staticDefault || "0").toString());
        };

        const incomeItems: IncomeItem[] = decryptedSources.map((source: any) => {
            const monthlyRecord = decryptedMonthlyIncomes.find((m: any) => m.income_source_id === source.id);
            const amount = resolveAmount(monthlyRecord, incomeCarry.get(source.id), source.default_amount);
            return {
                id: monthlyRecord?.id || `new-${source.id}`,
                name: source.name,
                amount,
                defaultAmount: source.default_amount ?? 0,
                source_id: source.id,
                created_by: source.created_by,
                isMine: source.created_by === user.id,
            };
        });

        const expenseItems: ExpenseItem[] = decryptedCategories.map((category: any) => {
            const monthlyRecord = decryptedMonthlyExpenses.find((m: any) => m.expense_id === category.id);
            const amount = resolveAmount(monthlyRecord, expenseCarry.get(category.id), category.default_amount);
            return {
                id: monthlyRecord?.id || `new-${category.id}`,
                name: category.name,
                amount,
                defaultAmount: category.default_amount ?? 0,
                category: category.category,
                expense_id: category.id,
            };
        });

        setIncomes(incomeItems);
        setExpenses(expenseItems);
        setReviewStatus((statusData as ReviewStatusRow[]) || []);

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
            return next;
        });
    }, [household, user, monthStart, monthEnd, currentMonth, decryptIncomeSources, decryptExpenses]);

    useEffect(() => {
        if (open && user && household) {
            // Reset transient UI state when wizard opens
            setAmounts({});
            setConfirmFinalize(false);
            setActiveTab("income");
            fetchData();
        }
    }, [open, user, household, fetchData]);

    // Poll every 15s while wizard is open so each user sees the other's
    // acceptances and amount changes without manual refresh.
    useEffect(() => {
        if (!open) return;
        const id = window.setInterval(() => {
            fetchData();
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [open, fetchData]);

    const handleAmountChange = (key: string, value: string) => {
        setAmounts(prev => ({ ...prev, [key]: value }));
    };

    const writeStatus = async (scope: ReviewScope) => {
        if (!household || !user) return;
        const { error } = await supabase.from("monthly_review_status").upsert({
            household_id: household.id,
            user_id: user.id,
            month: currentMonth,
            scope,
            accepted_at: new Date().toISOString(),
        }, { onConflict: "household_id,user_id,month,scope" });
        if (error) throw error;
    };

    const acceptIncome = async () => {
        if (!household || !user) return;
        setSavingScope("income");

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        try {
            const myIncomes = incomes.filter(i => i.isMine);
            for (const income of myIncomes) {
                const amount = parseFloat(amounts[`income-${income.source_id}`] || "0");
                const baseData = {
                    household_id: household.id,
                    income_source_id: income.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    amount,
                    created_by: user.id,
                };
                const data = await encryptMonthlyIncome(baseData);
                const { error } = await supabase.from("monthly_incomes").upsert(data, {
                    onConflict: "income_source_id,month",
                });
                if (error) throw error;
            }

            await writeStatus("income");

            toast.success("Income accepted");
            await fetchData();
            setActiveTab("expenses");
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
                    amount,
                    created_by: user.id,
                };
                const data = await encryptMonthlyExpense(baseData);
                const { error } = await supabase.from("monthly_expenses").upsert(data, {
                    onConflict: "expense_id,month",
                });
                if (error) throw error;
            }

            await writeStatus("expenses");

            toast.success("Expenses verified");
            await fetchData();
        } catch (error: any) {
            console.error("Error saving expenses:", error);
            toast.error(error.message || "Failed to save expenses");
        } finally {
            setSavingScope(null);
        }
    };

    const finalize = async () => {
        if (!household || !user) return;
        setSavingScope("finalized");
        try {
            await writeStatus("finalized");
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
    const finalizedRow = reviewStatus.find(r => r.scope === "finalized");
    const isFinalized = !!finalizedRow;
    const myIncomeAccepted = incomeAcceptedUserIds.has(user?.id || "");
    const allMembersAcceptedIncome = members.length > 0 && members.every(m => incomeAcceptedUserIds.has(m.user_id));
    const canFinalize = allMembersAcceptedIncome && expensesVerified && !isFinalized;
    const pendingIncomeMembers = members.filter(m => !incomeAcceptedUserIds.has(m.user_id));
    const myIncomeCount = incomes.filter(i => i.isMine).length;
    const finalizerName = isFinalized
        ? members.find(m => m.user_id === finalizedRow!.user_id)?.profiles?.full_name || "A household member"
        : null;

    const totalIncome = incomes.reduce((sum, item) => sum + parseFloat(amounts[`income-${item.source_id}`] || "0"), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(amounts[`expense-${item.expense_id}`] || "0"), 0);
    const balance = totalIncome - totalExpenses;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-primary" /> Monthly Review
                    </DialogTitle>
                    <DialogDescription>
                        {formatFinancialMonth(currentMonth, financialMonthStart)} • Review your income and expenses
                    </DialogDescription>
                </DialogHeader>

                {isFinalized && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                        <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <div>
                            <p className="font-medium">Review finalized</p>
                            <p className="text-xs text-muted-foreground">
                                Finalized by {finalizerName} on {format(new Date(finalizedRow!.accepted_at), "MMM d, HH:mm")}.
                                Use the Income or Expenses page to make corrections.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-500 font-medium">+{totalIncome.toFixed(0)} {currency}</span>
                        <span className="text-red-500 font-medium">-{totalExpenses.toFixed(0)} {currency}</span>
                    </div>
                    <span className={`font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        = {balance >= 0 ? '+' : ''}{balance.toFixed(0)} {currency}
                    </span>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expenses")} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="income" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Income
                            {myIncomeAccepted && <Check className="h-3 w-3 text-green-500" />}
                        </TabsTrigger>
                        <TabsTrigger value="expenses" className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            Expenses
                            {expensesVerified && <Check className="h-3 w-3 text-green-500" />}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="income" className="flex-1 overflow-y-auto mt-4 space-y-2">
                        {incomes.map(item => {
                            const otherMember = !item.isMine ? members.find(m => m.user_id === item.created_by) : null;
                            const ownerName = otherMember?.profiles?.full_name || "Other member";
                            const editable = item.isMine && !isFinalized;
                            return (
                                <div key={item.source_id} className={`flex items-center justify-between p-3 rounded-lg border bg-background/50 ${item.isMine ? 'border-border' : 'border-border/40 opacity-60'}`}>
                                    <div className="flex items-center gap-2">
                                        {!item.isMine && <Lock className="h-3 w-3 text-muted-foreground" />}
                                        <div>
                                            <span className="text-sm font-medium">{item.name}</span>
                                            {!item.isMine && (
                                                <p className="text-[10px] text-muted-foreground">{ownerName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            disabled={!editable}
                                            value={amounts[`income-${item.source_id}`] || "0"}
                                            onChange={(e) => handleAmountChange(`income-${item.source_id}`, e.target.value)}
                                            className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:cursor-not-allowed ${Math.abs(parseFloat(amounts[`income-${item.source_id}`] || "0") - item.defaultAmount) < 0.01
                                                ? 'border-green-500'
                                                : 'border-lime-400'
                                                }`}
                                        />
                                        <span className="text-sm text-muted-foreground w-10">{currency}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {myIncomeCount === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">You don't have any income sources to review.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="expenses" className="flex-1 overflow-y-auto mt-4 space-y-2">
                        {expenses.map(item => {
                            const cat = item.category ? getCategoryById(item.category) : null;
                            const Icon = cat?.icon;
                            return (
                                <div key={item.expense_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                                    <div className="flex items-center gap-2">
                                        {Icon && <Icon className="h-4 w-4" style={{ color: cat?.color }} />}
                                        <span className="text-sm font-medium">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            disabled={isFinalized}
                                            value={amounts[`expense-${item.expense_id}`] || "0"}
                                            onChange={(e) => handleAmountChange(`expense-${item.expense_id}`, e.target.value)}
                                            className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:cursor-not-allowed ${Math.abs(parseFloat(amounts[`expense-${item.expense_id}`] || "0") - item.defaultAmount) < 0.01
                                                ? 'border-green-500'
                                                : 'border-lime-400'
                                                }`}
                                        />
                                        <span className="text-sm text-muted-foreground w-10">{currency}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </TabsContent>
                </Tabs>

                {!isFinalized && (
                    <div className="pt-4 border-t border-border space-y-3">
                        {activeTab === "income" ? (
                            <Button
                                onClick={acceptIncome}
                                disabled={savingScope !== null || myIncomeCount === 0}
                                className="w-full"
                                size="lg"
                                variant={myIncomeAccepted ? "outline" : "default"}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                {savingScope === "income" ? "Saving..." : myIncomeAccepted ? "Re-accept my income" : "Accept my income"}
                            </Button>
                        ) : (
                            <Button
                                onClick={verifyExpenses}
                                disabled={savingScope !== null}
                                className="w-full"
                                size="lg"
                                variant={expensesVerified ? "outline" : "default"}
                            >
                                <Check className="h-4 w-4 mr-2" />
                                {savingScope === "expenses" ? "Saving..." : expensesVerified ? "Re-verify expenses" : "Verify expenses"}
                            </Button>
                        )}

                        {!canFinalize && (myIncomeAccepted || expensesVerified) && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <div className="space-y-1">
                                    {!expensesVerified && <p>Expenses still need to be verified.</p>}
                                    {pendingIncomeMembers.length > 0 && (
                                        <p>
                                            Waiting on {pendingIncomeMembers.map(m => m.profiles?.full_name || "a member").join(", ")} to accept income.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {canFinalize && (
                            <label className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer">
                                <Checkbox
                                    checked={confirmFinalize}
                                    onCheckedChange={(v) => setConfirmFinalize(v === true)}
                                    className="mt-0.5"
                                />
                                <span className="text-xs text-muted-foreground leading-snug">
                                    I confirm this month's review is complete. The Income and Expenses
                                    pages will switch to this month after finalizing. Further changes
                                    happen on those pages, not here.
                                </span>
                            </label>
                        )}

                        <Button
                            onClick={finalize}
                            disabled={!canFinalize || !confirmFinalize || savingScope !== null}
                            className="w-full"
                            size="lg"
                            variant={canFinalize && confirmFinalize ? "default" : "secondary"}
                        >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            {savingScope === "finalized" ? "Finalizing..." : "Finalize review"}
                        </Button>
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
            .from("monthly_review_status")
            .select("month, scope")
            .eq("household_id", householdId)
            .eq("scope", "finalized")
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
