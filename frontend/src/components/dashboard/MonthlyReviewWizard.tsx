import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Check, ClipboardCheck, Lock, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields, expenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCategoryById } from "@/constants/expenseCategories";

// `monthly_review_status` was added in migration 20260506120000 and is not yet
// in the generated supabase types. Casts will go away after the next
// `npx supabase gen types` run.
type ReviewScope = "income" | "expenses";
interface ReviewStatusRow {
    user_id: string;
    scope: ReviewScope;
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

export const MonthlyReviewWizard = ({
    open,
    onOpenChange,
    onComplete,
}: MonthlyReviewWizardProps) => {
    const { user } = useAuth();
    const { household, members } = useHousehold();
    const [activeTab, setActiveTab] = useState<ReviewScope>("income");
    const [incomes, setIncomes] = useState<IncomeItem[]>([]);
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [reviewStatus, setReviewStatus] = useState<ReviewStatusRow[]>([]);
    const [savingScope, setSavingScope] = useState<ReviewScope | null>(null);

    const financialMonthStart = household?.financial_month_start || 25;
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);
    const currency = household?.currency || "SEK";

    const { decryptRecords: decryptIncomeSources } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptMonthlyIncomes, encryptRecord: encryptMonthlyIncome } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptExpenses } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(monthlyExpenseFields);

    useEffect(() => {
        if (open && user && household) {
            fetchData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, user, household]);

    const fetchData = async () => {
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
            (supabase as any).from("monthly_review_status").select("user_id, scope").eq("household_id", household.id).eq("month", currentMonth),
        ]);

        const decryptedSources = await decryptIncomeSources(sourcesData || []);
        const decryptedMonthlyIncomes = await decryptMonthlyIncomes(monthlyIncomesData || []);
        const decryptedCategories = await decryptExpenses(categoriesData || []);
        const decryptedMonthlyExpenses = await decryptMonthlyExpenses(monthlyExpensesData || []);

        const incomeItems: IncomeItem[] = decryptedSources.map((source: any) => {
            const monthlyRecord = decryptedMonthlyIncomes.find((m: any) => m.income_source_id === source.id);
            return {
                id: monthlyRecord?.id || `new-${source.id}`,
                name: source.name,
                amount: monthlyRecord?.amount ?? source.default_amount ?? 0,
                defaultAmount: source.default_amount ?? 0,
                source_id: source.id,
                created_by: source.created_by,
                isMine: source.created_by === user.id,
            };
        });

        const expenseItems: ExpenseItem[] = decryptedCategories.map((category: any) => {
            const monthlyRecord = decryptedMonthlyExpenses.find((m: any) => m.expense_id === category.id);
            return {
                id: monthlyRecord?.id || `new-${category.id}`,
                name: category.name,
                amount: monthlyRecord?.amount ?? category.default_amount ?? 0,
                defaultAmount: category.default_amount ?? 0,
                category: category.category,
                expense_id: category.id,
            };
        });

        setIncomes(incomeItems);
        setExpenses(expenseItems);
        setReviewStatus((statusData as ReviewStatusRow[]) || []);

        const initialAmounts: Record<string, string> = {};
        incomeItems.forEach(item => {
            initialAmounts[`income-${item.source_id}`] = item.amount.toString();
        });
        expenseItems.forEach(item => {
            initialAmounts[`expense-${item.expense_id}`] = item.amount.toString();
        });
        setAmounts(initialAmounts);
    };

    const handleAmountChange = (key: string, value: string) => {
        setAmounts(prev => ({ ...prev, [key]: value }));
    };

    const writeStatus = async (scope: ReviewScope) => {
        if (!household || !user) return;
        const { error } = await (supabase as any).from("monthly_review_status").upsert({
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

    const finalize = () => {
        onComplete();
        onOpenChange(false);
    };

    const incomeAcceptedUserIds = new Set(reviewStatus.filter(r => r.scope === "income").map(r => r.user_id));
    const expensesVerified = reviewStatus.some(r => r.scope === "expenses");
    const myIncomeAccepted = incomeAcceptedUserIds.has(user?.id || "");
    const allMembersAcceptedIncome = members.length > 0 && members.every(m => incomeAcceptedUserIds.has(m.user_id));
    const canFinalize = allMembersAcceptedIncome && expensesVerified;
    const pendingIncomeMembers = members.filter(m => !incomeAcceptedUserIds.has(m.user_id));
    const myIncomeCount = incomes.filter(i => i.isMine).length;

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

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-500 font-medium">+{totalIncome.toFixed(0)} {currency}</span>
                        <span className="text-red-500 font-medium">-{totalExpenses.toFixed(0)} {currency}</span>
                    </div>
                    <span className={`font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        = {balance >= 0 ? '+' : ''}{balance.toFixed(0)} {currency}
                    </span>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewScope)} className="flex-1 overflow-hidden flex flex-col">
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
                                            disabled={!item.isMine}
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
                                            value={amounts[`expense-${item.expense_id}`] || "0"}
                                            onChange={(e) => handleAmountChange(`expense-${item.expense_id}`, e.target.value)}
                                            className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 ${Math.abs(parseFloat(amounts[`expense-${item.expense_id}`] || "0") - item.defaultAmount) < 0.01
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

                    <Button
                        onClick={finalize}
                        disabled={!canFinalize}
                        className="w-full"
                        size="lg"
                        variant={canFinalize ? "default" : "secondary"}
                    >
                        <Check className="h-4 w-4 mr-2" />
                        Finalize review
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Banner gating: review is "done" when every household member has accepted
 * income AND expenses have been verified for the current financial month.
 */
export function useMonthlyReviewStatus(householdId: string | undefined, financialMonthStart: number = 25) {
    const [needsReview, setNeedsReview] = useState(false);
    const { members } = useHousehold();
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);

    const refresh = useCallback(async () => {
        if (!householdId || members.length === 0) {
            setNeedsReview(false);
            return;
        }

        const { data } = await (supabase as any)
            .from("monthly_review_status")
            .select("user_id, scope")
            .eq("household_id", householdId)
            .eq("month", currentMonth);

        const status = (data as ReviewStatusRow[]) || [];
        const incomeAcceptedUserIds = new Set(status.filter(r => r.scope === "income").map(r => r.user_id));
        const expensesVerified = status.some(r => r.scope === "expenses");
        const allAcceptedIncome = members.every(m => incomeAcceptedUserIds.has(m.user_id));

        setNeedsReview(!(allAcceptedIncome && expensesVerified));
    }, [householdId, currentMonth, members]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { needsReview, markAsReviewed: refresh };
}
