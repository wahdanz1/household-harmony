import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/utils/formatting";
import { EXPENSE_CATEGORIES, getCategoryById } from "@/constants/expenseCategories";
import { supabase } from "@/integrations/supabase/client";
import { useEncryptedFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";

export interface ParsedTransaction {
    date: string;
    merchant: string;
    amount: number;
    category: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface ParsedTransactionsReviewProps {
    transactions: ParsedTransaction[];
    creditCards: any[];
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
    onAccept: (savedCount: number) => void;
    onCancel: () => void;
}

export const ParsedTransactionsReview = ({
    transactions: initialTransactions,
    creditCards,
    householdId,
    currency,
    monthStart,
    monthEnd,
    onAccept,
    onCancel,
}: ParsedTransactionsReviewProps) => {
    const [transactions, setTransactions] = useState<ParsedTransaction[]>(initialTransactions);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialTransactions.map((_, i) => i)));
    const [saving, setSaving] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(creditCards[0]?.id || "");
    const { encryptRecord: encryptMonthlyExpense } = useEncryptedFields(monthlyExpenseFields);

    const handleToggleSelect = (index: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIds(newSelected);
    };

    const handleUpdateField = (index: number, field: keyof ParsedTransaction, value: any) => {
        const newTransactions = [...transactions];
        newTransactions[index] = { ...newTransactions[index], [field]: value };
        setTransactions(newTransactions);
    };

    const totalSelected = useMemo(() => {
        return transactions
            .filter((_, i) => selectedIds.has(i))
            .reduce((sum, t) => sum + t.amount, 0);
    }, [transactions, selectedIds]);

    const handleAccept = async () => {
        setSaving(true);
        let successCount = 0;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Please log in again");
            setSaving(false);
            return;
        }

        const monthStr = format(monthStart, "yyyy-MM-dd");
        const monthStartIso = format(monthStart, "yyyy-MM-dd");
        const monthEndIso = format(monthEnd, "yyyy-MM-dd");

        const selectedTransactions = transactions.filter((_, i) => selectedIds.has(i));

        const categoryGroups = new Map<string, { amount: number; merchants: string[] }>();
        for (const t of selectedTransactions) {
            const existing = categoryGroups.get(t.category);
            if (existing) {
                existing.amount += t.amount;
                existing.merchants.push(t.merchant);
            } else {
                categoryGroups.set(t.category, { amount: t.amount, merchants: [t.merchant] });
            }
        }

        for (const [category, { amount, merchants }] of categoryGroups) {
            try {
                const roundedAmount = Math.round(amount);

                const { data: existingExpense } = await supabase
                    .from("expenses")
                    .select("id")
                    .eq("household_id", householdId)
                    .eq("category", category)
                    .eq("is_credit", true)
                    .maybeSingle();

                let upsertErr: { message?: string } | null = null;

                if (existingExpense?.id) {
                    // Budgeted credit-paid source — write the month's actual.
                    const monthlyData = {
                        household_id: householdId,
                        expense_id: existingExpense.id,
                        month: monthStr,
                        month_start: monthStartIso,
                        month_end: monthEndIso,
                        actual_amount: roundedAmount,
                        created_by: user.id,
                    };
                    const encryptedMonthly = await encryptMonthlyExpense(monthlyData);
                    const { error } = await supabase
                        .from("monthly_expenses")
                        .upsert(encryptedMonthly, { onConflict: "expense_id,month" });
                    upsertErr = error;
                } else {
                    // No budgeted source for this category — record as a one-time
                    // entry on this month only. No source pollution; the row is
                    // visible in the month it was charged and nowhere else.
                    // Smart Defaults can later recommend promoting frequent
                    // categories to budgeted items (#68).
                    const categoryLabel = getCategoryById(category)?.label
                        || category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");

                    const { data: existingOneTime } = await supabase
                        .from("monthly_expenses")
                        .select("id")
                        .eq("household_id", householdId)
                        .eq("month", monthStr)
                        .eq("one_time_category", category)
                        .is("expense_id", null)
                        .maybeSingle();

                    const oneTimeData = {
                        household_id: householdId,
                        expense_id: null,
                        month: monthStr,
                        month_start: monthStartIso,
                        month_end: monthEndIso,
                        one_time_name: categoryLabel,
                        one_time_category: category,
                        actual_amount: roundedAmount,
                        created_by: user.id,
                    };
                    const encryptedOneTime = await encryptMonthlyExpense(oneTimeData);

                    if (existingOneTime?.id) {
                        const { error } = await supabase
                            .from("monthly_expenses")
                            .update(encryptedOneTime)
                            .eq("id", existingOneTime.id);
                        upsertErr = error;
                    } else {
                        const { error } = await supabase
                            .from("monthly_expenses")
                            .insert(encryptedOneTime);
                        upsertErr = error;
                    }
                }

                if (upsertErr) {
                    console.error("Failed to upsert monthly_expenses:", upsertErr);
                    continue;
                }

                if (category !== 'other') {
                    for (const merchant of merchants) {
                        await supabase.from("merchant_categories").upsert({
                            user_id: user.id,
                            household_id: householdId,
                            merchant_name: merchant,
                            category,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id,household_id,merchant_name' });
                    }
                }

                successCount++;
            } catch (err) {
                console.error("Failed to save category group:", category, err);
            }
        }

        setSaving(false);

        if (successCount === categoryGroups.size) {
            toast.success(`Saved ${successCount} categor${successCount === 1 ? 'y' : 'ies'} for ${format(monthStart, "MMM yyyy")}`);
            onAccept(successCount);
        } else if (successCount > 0) {
            toast.warning(`Partially saved: ${successCount} of ${categoryGroups.size} categories`);
            onAccept(successCount);
        } else {
            toast.error("Failed to save. Please try again.");
        }
    };

    const getConfidenceColor = (confidence: string) => {
        switch (confidence) {
            case "HIGH": return "bg-accent/20 text-accent border-accent/50";
            case "MEDIUM": return "bg-warn/20 text-warn border-warn/50";
            case "LOW": return "bg-danger/20 text-danger border-danger/50";
            default: return "bg-surface-2 text-muted";
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink">Review extracted transactions</h3>
                    <p className="text-xs text-muted mt-0.5">
                        {transactions.length} transactions found. Edit categories or merchants as needed.
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
                    <X className="h-4 w-4 mr-1" /> Discard
                </Button>
            </div>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end bg-bg/40 p-4 rounded-lg border border-line">
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Select Credit Card</label>
                        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                            <SelectTrigger className="bg-bg">
                                <SelectValue placeholder="Select card..." />
                            </SelectTrigger>
                            <SelectContent>
                                {creditCards.map(card => (
                                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-muted">Selected Total</p>
                        <p className="text-xl font-bold text-accent">{formatCurrency(totalSelected, currency)}</p>
                        <p className="text-xs text-muted">{selectedIds.size} transactions selected</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {transactions.map((t, i) => {
                        const selected = selectedIds.has(i);
                        let dateLabel = t.date;
                        try { dateLabel = format(new Date(t.date), "d MMM"); } catch { /* keep raw */ }
                        return (
                            <div
                                key={i}
                                className={`flex flex-col gap-1.5 p-2.5 rounded-lg border transition-all ${selected ? "border-line bg-surface" : "border-line/40 bg-surface/30 opacity-60"
                                    }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => handleToggleSelect(i)}
                                    />
                                    <span className="flex-1 min-w-0 text-sm font-medium truncate" title={t.merchant}>
                                        {t.merchant}
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                                        {Math.round(t.amount).toLocaleString("sv-SE")} {currency}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 pl-7">
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted min-w-0">
                                        <span>{dateLabel}</span>
                                        <span className="opacity-50">·</span>
                                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${getConfidenceColor(t.confidence)}`}>
                                            {t.confidence}
                                        </Badge>
                                    </div>
                                    <Select
                                        value={t.category}
                                        onValueChange={(v) => handleUpdateField(i, "category", v)}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-auto min-w-[120px] max-w-[160px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {EXPENSE_CATEGORIES.map(cat => (
                                                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-line">
                    <Button
                        className="col-span-2"
                        onClick={handleAccept}
                        disabled={saving || selectedIds.size === 0}
                    >
                        {saving ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            <><Check className="h-4 w-4 mr-2" /> Accept Selected ({selectedIds.size})</>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setSelectedIds(new Set(transactions.map((_, i) => i)))}
                        disabled={saving}
                    >
                        Select All
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setSelectedIds(new Set())}
                        disabled={saving}
                    >
                        Deselect All
                    </Button>
                </div>
            </div>
        </div>
    );
};
