import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/utils/formatting";
import { creditCategories } from "@/constants/creditCategories";
import { supabase } from "@/integrations/supabase/client";
import { useEncryptedFields, expenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";

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
    const { encryptRecord: encryptExpense } = useEncryptedFields(expenseFields);
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

        const monthStr = format(monthStart, "yyyy-MM");
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

                let expenseId: string;

                if (existingExpense?.id) {
                    expenseId = existingExpense.id;
                } else {
                    const expenseName = `Credit: ${category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')}`;
                    const newExpenseData = {
                        household_id: householdId,
                        category,
                        name: expenseName,
                        default_amount: 0,
                        created_by: user.id,
                        is_active: true,
                        is_credit: true,
                        sort_order: 999,
                    };

                    const encryptedExpense = await encryptExpense(newExpenseData);
                    const { data: created, error: createError } = await supabase
                        .from("expenses")
                        .insert({ ...encryptedExpense, category })
                        .select("id")
                        .single();

                    if (createError || !created) {
                        console.error("Failed to create expense:", createError);
                        continue;
                    }
                    expenseId = created.id;
                }

                const monthlyData = {
                    household_id: householdId,
                    expense_id: expenseId,
                    month: monthStr,
                    month_start: monthStartIso,
                    month_end: monthEndIso,
                    actual_amount: roundedAmount,
                    created_by: user.id,
                };
                const encryptedMonthly = await encryptMonthlyExpense(monthlyData);
                const { error: upsertErr } = await supabase
                    .from("monthly_expenses")
                    .upsert(encryptedMonthly, { onConflict: "expense_id,month" });

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
            toast.success(`Saved ${successCount} categor${successCount === 1 ? 'y' : 'ies'} for ${monthStr}`);
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
            case "HIGH": return "bg-success/20 text-success border-success/50";
            case "MEDIUM": return "bg-warning/20 text-warning border-warning/50";
            case "LOW": return "bg-destructive/20 text-destructive border-destructive/50";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <Card variant="muted" className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Review Extracted Transactions</CardTitle>
                        <CardDescription>
                            {transactions.length} transactions found. Edit categories or merchants as needed.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={onCancel}>
                            <X className="h-4 w-4 mr-2" /> Cancel
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end bg-background/40 p-4 rounded-lg border border-border">
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Select Credit Card</label>
                        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                            <SelectTrigger className="bg-background">
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
                        <p className="text-sm text-muted-foreground">Selected Total</p>
                        <p className="text-xl font-bold text-primary">{formatCurrency(totalSelected, currency)}</p>
                        <p className="text-xs text-muted-foreground">{selectedIds.size} transactions selected</p>
                    </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {transactions.map((t, i) => {
                        return (
                            <div
                                key={i}
                                className={`flex flex-col gap-3 p-3 rounded-lg border transition-all ${selectedIds.has(i) ? 'bg-background/60 border-primary/30' : 'bg-background/20 border-border opacity-60'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={selectedIds.has(i)}
                                        onCheckedChange={() => handleToggleSelect(i)}
                                    />
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Date</p>
                                            <Input
                                                type="date"
                                                value={t.date}
                                                onChange={(e) => handleUpdateField(i, 'date', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Merchant</p>
                                            <Input
                                                value={t.merchant}
                                                onChange={(e) => handleUpdateField(i, 'merchant', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Amount</p>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    value={t.amount}
                                                    onChange={(e) => handleUpdateField(i, 'amount', parseFloat(e.target.value))}
                                                    className="h-8 text-sm text-right"
                                                />
                                                <span className="text-xs text-muted-foreground">{currency}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Category</p>
                                            <Select
                                                value={t.category}
                                                onValueChange={(v) => handleUpdateField(i, 'category', v)}
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {creditCategories.map(cat => (
                                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pl-8">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`text-[10px] h-4 ${getConfidenceColor(t.confidence)}`}>
                                            {t.confidence} CONFIDENCE
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border">
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
            </CardContent>
        </Card>
    );
};
