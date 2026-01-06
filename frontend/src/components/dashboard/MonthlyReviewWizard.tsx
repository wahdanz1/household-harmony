import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Check, ChevronRight, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields, expenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCategoryById } from "@/constants/expenseCategories";

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
    const { household } = useHousehold();
    const [activeTab, setActiveTab] = useState<"income" | "expenses">("income");
    const [incomes, setIncomes] = useState<IncomeItem[]>([]);
    const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    const financialMonthStart = household?.financial_month_start || 25;
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);
    const currency = household?.currency || "SEK";

    // Encryption hooks
    const { decryptRecords: decryptIncomeSources } = useEncryptedFields(incomeSourceFields);
    const { decryptRecords: decryptMonthlyIncomes, encryptRecord: encryptMonthlyIncome } = useEncryptedFields(monthlyIncomeFields);
    const { decryptRecords: decryptExpenses } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(monthlyExpenseFields);

    useEffect(() => {
        if (open && user && household) {
            fetchData();
        }
    }, [open, user, household]);

    const fetchData = async () => {
        if (!household) return;

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        // Fetch income sources and monthly incomes
        const [
            { data: sourcesData },
            { data: monthlyIncomesData },
            { data: categoriesData },
            { data: monthlyExpensesData },
        ] = await Promise.all([
            supabase.from("income_sources").select("*").eq("household_id", household.id).eq("is_active", true),
            supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
            supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).order("sort_order"),
            supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
        ]);

        // Decrypt data
        const decryptedSources = await decryptIncomeSources(sourcesData || []);
        const decryptedMonthlyIncomes = await decryptMonthlyIncomes(monthlyIncomesData || []);
        const decryptedCategories = await decryptExpenses(categoriesData || []);
        const decryptedMonthlyExpenses = await decryptMonthlyExpenses(monthlyExpensesData || []);

        // Build income items
        const incomeItems: IncomeItem[] = decryptedSources.map((source: any) => {
            const monthlyRecord = decryptedMonthlyIncomes.find((m: any) => m.source_id === source.id);
            return {
                id: monthlyRecord?.id || `new-${source.id}`,
                name: source.name,
                amount: monthlyRecord?.amount ?? source.default_amount ?? 0,
                defaultAmount: source.default_amount ?? 0,
                source_id: source.id,
            };
        });

        // Build expense items
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

        // Initialize amounts
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
        setHasChanges(true);
    };

    const handleAccept = async () => {
        if (!household || !user) return;
        setSaving(true);

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        try {
            // Save income records
            for (const income of incomes) {
                const amount = parseFloat(amounts[`income-${income.source_id}`] || "0");
                const baseData = {
                    household_id: household.id,
                    source_id: income.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    amount,
                    created_by: user.id,
                };
                const data = await encryptMonthlyIncome(baseData);

                await supabase.from("monthly_incomes").upsert(data, {
                    onConflict: "household_id,source_id,month",
                });
            }

            // Save expense records
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

                await supabase.from("monthly_expenses").upsert(data, {
                    onConflict: "household_id,expense_id,month",
                });
            }

            // Mark as reviewed in localStorage
            const reviewKey = `monthly-review-${household.id}-${currentMonth}`;
            localStorage.setItem(reviewKey, new Date().toISOString());

            onComplete();
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving review:", error);
        } finally {
            setSaving(false);
        }
    };

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

                {/* Summary Bar */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-500 font-medium">+{totalIncome.toFixed(0)} {currency}</span>
                        <span className="text-red-500 font-medium">-{totalExpenses.toFixed(0)} {currency}</span>
                    </div>
                    <span className={`font-bold ${balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        = {balance >= 0 ? '+' : ''}{balance.toFixed(0)} {currency}
                    </span>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expenses")} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="income" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Income
                        </TabsTrigger>
                        <TabsTrigger value="expenses" className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            Expenses
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="income" className="flex-1 overflow-y-auto mt-4 space-y-2">
                        {incomes.map(item => (
                            <div key={item.source_id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
                                <span className="text-sm font-medium">{item.name}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={amounts[`income-${item.source_id}`] || "0"}
                                        onChange={(e) => handleAmountChange(`income-${item.source_id}`, e.target.value)}
                                        className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 ${Math.abs(parseFloat(amounts[`income-${item.source_id}`] || "0") - item.defaultAmount) < 0.01
                                            ? 'border-green-500'
                                            : 'border-lime-400'
                                            }`}
                                    />
                                    <span className="text-sm text-muted-foreground w-10">{currency}</span>
                                </div>
                            </div>
                        ))}
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

                {/* Action Button */}
                <div className="pt-4 border-t border-border">
                    <Button onClick={handleAccept} disabled={saving} className="w-full" size="lg">
                        <Check className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : hasChanges ? "Accept Changes" : "Accept All"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/**
 * Hook to check if monthly review is needed
 */
export function useMonthlyReviewStatus(householdId: string | undefined, financialMonthStart: number = 25) {
    const [needsReview, setNeedsReview] = useState(false);
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);

    useEffect(() => {
        if (!householdId) return;

        const reviewKey = `monthly-review-${householdId}-${currentMonth}`;
        const lastReview = localStorage.getItem(reviewKey);

        // If no review for current month, show banner
        setNeedsReview(!lastReview);
    }, [householdId, currentMonth]);

    const markAsReviewed = () => {
        if (!householdId) return;
        const reviewKey = `monthly-review-${householdId}-${currentMonth}`;
        localStorage.setItem(reviewKey, new Date().toISOString());
        setNeedsReview(false);
    };

    return { needsReview, markAsReviewed };
}
