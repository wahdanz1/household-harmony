import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CreditCardManagement } from "./credit/CreditCardManagement";
import { CreditCard as CreditCardIcon, ChevronDown, ChevronUp, Check } from "lucide-react";
import { getCategoryById } from "@/constants/expenseCategories";
import { useEncryptedFields, expenseFields, monthlyExpenseFields, creditCardExpenseFields, creditCardFields } from "@/hooks/useEncryptedFields";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";

interface CreditCardExpense {
    id: string;
    credit_card_id: string;
    category: string;
    description: string;
    amount: number;
    notes: string | null;
    credit_cards: {
        name: string;
    };
}

interface CreditCard {
    id: string;
    name: string;
    monthly_limit: number;
}

interface BudgetedCreditExpense {
    id: string;
    name: string;
    category: string;
    default_amount: number;
    monthly_amount: number;
}

interface CreditTabProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
}

export const CreditTab = ({ householdId, currency, monthStart, monthEnd }: CreditTabProps) => {
    const { user } = useAuth();
    const { isUnlocked } = useEncryption();
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
    const [budgetedCredit, setBudgetedCredit] = useState<BudgetedCreditExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [budgetExpanded, setBudgetExpanded] = useState(true);
    const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    const { decryptRecords: decryptExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses } = useEncryptedFields(monthlyExpenseFields);
    const { decryptRecords: decryptCreditCardExpenses } = useEncryptedFields(creditCardExpenseFields);
    const { decryptRecords: decryptCreditCards } = useEncryptedFields(creditCardFields);

    // Debounce timer ref
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const amountsRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (isUnlocked) {
            fetchData();
        }
    }, [householdId, isUnlocked]);

    // Initialize edited amounts when budgetedCredit changes
    useEffect(() => {
        const amounts: Record<string, string> = {};
        budgetedCredit.forEach(item => {
            amounts[item.id] = item.monthly_amount.toString();
        });
        setEditedAmounts(amounts);
        amountsRef.current = amounts;
    }, [budgetedCredit]);

    const fetchData = async () => {
        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");

        const [
            { data: cardsData },
            { data: expensesData },
            { data: creditCategoriesData },
            { data: monthlyData },
        ] = await Promise.all([
            supabase.from("credit_cards").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", householdId).gte("month_end", startStr).lte("month_start", endStr),
            (supabase as any).from("expenses").select("*").eq("household_id", householdId).eq("is_active", true).eq("is_credit", true),
            supabase.from("monthly_expenses").select("*").eq("household_id", householdId).gte("month_end", startStr).lte("month_start", endStr),
        ]);

        const decryptedCardsRaw = await decryptCreditCards(cardsData || []);
        // Ensure monthly_limit is a number
        const decryptedCards = decryptedCardsRaw.map((card: any) => ({
            ...card,
            monthly_limit: Number(card.monthly_limit || 0)
        }));
        setCreditCards(decryptedCards);

        // Decrypt credit card expenses
        const decryptedCCExpenses = await decryptCreditCardExpenses(expensesData || []);
        setExpenses(decryptedCCExpenses);

        // Decrypt and build budgeted credit items
        if (creditCategoriesData && creditCategoriesData.length > 0) {
            const decryptedCategories = await decryptExpenses(creditCategoriesData);
            const decryptedMonthly = await decryptMonthlyExpenses(monthlyData || []);

            const budgetItems: BudgetedCreditExpense[] = decryptedCategories.map((cat: any) => {
                const monthly = decryptedMonthly.find((m: any) => m.expense_id === cat.id);
                return {
                    id: cat.id,
                    name: cat.name,
                    category: cat.category,
                    default_amount: cat.default_amount || 0,
                    monthly_amount: monthly?.amount ?? cat.default_amount ?? 0,
                };
            });
            setBudgetedCredit(budgetItems);
        } else {
            setBudgetedCredit([]);
        }

        setLoading(false);
    };

    // Save a single expense amount
    const saveAmount = useCallback(async (expenseId: string, amount: number) => {
        if (!user) return;

        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");
        const currentMonth = format(monthStart, "yyyy-MM");

        setSaveStatus("saving");

        try {
            const baseData = {
                household_id: householdId,
                expense_id: expenseId,
                month: currentMonth,
                month_start: startStr,
                month_end: endStr,
                amount,
                created_by: user.id,
            };

            // Encrypt if needed (amount field)
            const data = await encryptMonthlyExpense(baseData);

            const { error } = await supabase
                .from("monthly_expenses")
                .upsert(data, { onConflict: "expense_id,month" });

            if (error) throw error;

            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (error) {
            console.error("Failed to save amount:", error);
            toast.error("Failed to save");
            setSaveStatus("idle");
        }
    }, [user, householdId, monthStart, monthEnd, encryptMonthlyExpense]);

    // Debounced save all changed amounts
    const debouncedSave = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(async () => {
            // Find which amounts changed
            for (const item of budgetedCredit) {
                const currentValue = amountsRef.current[item.id];
                const numValue = parseFloat(currentValue) || 0;
                if (numValue !== item.monthly_amount) {
                    await saveAmount(item.id, numValue);
                }
            }
        }, 1000);
    }, [budgetedCredit, saveAmount]);

    const handleAmountChange = (expenseId: string, value: string) => {
        setEditedAmounts(prev => ({ ...prev, [expenseId]: value }));
        amountsRef.current[expenseId] = value;
        debouncedSave();
    };

    const calculateCardTotal = (cardId: string) => {
        return expenses
            .filter(e => e.credit_card_id === cardId)
            .reduce((sum, e) => sum + e.amount, 0);
    };

    // Calculate total from edited amounts
    const totalBudgetedCredit = Object.values(editedAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    if (!isUnlocked) {
        return <VaultLockedAlert className="mt-6" />;
    }

    return (
        <div className="space-y-6">
            {/* Budgeted Credit Expenses Section */}
            {budgetedCredit.length > 0 && (
                <div className="bg-muted/40 rounded-lg border border-border overflow-hidden">
                    <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => setBudgetExpanded(!budgetExpanded)}
                    >
                        <div className="flex items-center gap-3">
                            <CreditCardIcon className="h-5 w-5 text-purple-500" />
                            <div>
                                <h3>Budgeted Credit Expenses</h3>
                                <p className="text-sm text-muted-foreground">
                                    {budgetedCredit.length} categories
                                    {saveStatus === "saving" && " • Saving..."}
                                    {saveStatus === "saved" && (
                                        <span className="text-green-500 ml-1">
                                            <Check className="inline h-3 w-3" /> Saved
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-purple-500">{totalBudgetedCredit.toFixed(0)} {currency}</span>
                            {budgetExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </div>
                    {budgetExpanded && (
                        <div className="border-t border-border divide-y divide-border/50">
                            {budgetedCredit.map(item => {
                                const cat = getCategoryById(item.category);
                                const Icon = cat?.icon;
                                const currentValue = parseFloat(editedAmounts[item.id] || "0");
                                const isDefault = currentValue === item.default_amount;

                                return (
                                    <div key={item.id} className="flex items-center justify-between p-3 px-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            {Icon && <Icon className="h-4 w-4" style={{ color: cat?.color }} />}
                                            <span className="text-sm">{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                value={editedAmounts[item.id] || ""}
                                                onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                                className={`w-24 text-right h-8 ${isDefault
                                                    ? "border-green-500/50 focus:border-green-500"
                                                    : "border-lime-500/50 focus:border-lime-500"
                                                    }`}
                                            />
                                            <span className="text-xs text-muted-foreground w-10">{currency}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {budgetedCredit.length === 0 && creditCards.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <CreditCardIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No credit expenses configured.</p>
                    <p className="text-sm mt-2">Mark expense categories as "Credit Card Expense" to track them here.</p>
                </div>
            )}

            {/* Credit Card Management */}
            <CreditCardManagement
                householdId={householdId}
                currency={currency}
                creditCards={creditCards}
                calculateCardTotal={calculateCardTotal}
                onUpdate={fetchData}
            />
        </div>
    );
};
