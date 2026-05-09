import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Check, ClipboardCheck, Lock, LockOpen, ShieldCheck, RotateCw, Sparkles } from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange, formatFinancialMonth } from "@/utils/dateUtils";
import { useEncryptedFields, incomeSourceFields, monthlyIncomeFields, expenseFields, monthlyExpenseFields } from "@/hooks/useEncryptedFields";
import { getCategoryById } from "@/constants/expenseCategories";
import { fetchHistoryByKey } from "@/utils/carryForward";
import { computeSmartDefault } from "@/services/smartDefaults";
import { reportSuccess, reportFailure, isDown } from "@/utils/outageMonitor";

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
    const [refreshing, setRefreshing] = useState(false);

    const manualRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchData();
        } finally {
            // Brief delay so the spinner is visible even on fast networks
            setTimeout(() => setRefreshing(false), 200);
        }
    };
    // Per-item override allowing the current user to edit another household
    // member's income source. Useful when reviewing together from a single
    // device — e.g. Daniel updates Sarah's salary while she's looking. The
    // value gets saved, but Sarah still has to log in and click "Accept my
    // income" to formally mark her side accepted.
    const [unlockedItems, setUnlockedItems] = useState<Set<string>>(new Set());

    const toggleUnlock = (sourceId: string) => {
        setUnlockedItems(prev => {
            const next = new Set(prev);
            if (next.has(sourceId)) next.delete(sourceId);
            else next.add(sourceId);
            return next;
        });
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

        let results;
        try {
            results = await Promise.all([
                supabase.from("income_sources").select("*").eq("household_id", household.id).eq("is_active", true),
                supabase.from("monthly_incomes").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
                // is_credit expenses are reviewed via the Credit tab's PDF flow, not here.
                supabase.from("expenses").select("*").eq("household_id", household.id).eq("is_active", true).not("is_credit", "is", true).order("sort_order"),
                supabase.from("monthly_expenses").select("*").eq("household_id", household.id).gte("month_end", startStr).lte("month_start", endStr),
                supabase.from("monthly_review_status").select("user_id, scope, accepted_at").eq("household_id", household.id).eq("month", currentMonth),
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
        ] = results;

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
            fetchHistoryByKey({
                table: "monthly_incomes",
                keyField: "income_source_id",
                keys: sourcesNeedingCarry.map((s: any) => s.id),
                householdId: household.id,
                beforeMonth: currentMonth,
                decrypt: decryptRefs.current.decryptMonthlyIncomes,
            }),
            fetchHistoryByKey({
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
            history: any[] | undefined,
            staticDefault: any
        ): number => {
            if (existing) return parseFloat((existing.amount || "0").toString());
            const smart = computeSmartDefault(history ?? []);
            if (smart.source != null) return smart.value;
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

    // Reset transient UI state ONLY when the wizard transitions to open.
    // Don't include `user` or `household` here — those refs can change (e.g.
    // when the tab regains focus and Supabase refreshes the auth session),
    // and resetting amounts would briefly flash all inputs to 0 before the
    // refetch repopulates them.
    useEffect(() => {
        if (open) {
            setConfirmFinalize(false);
            setActiveTab("income");
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
            // Save my own income items + any items I've unlocked for editing
            // on someone else's behalf. Their owner still needs to log in and
            // click Accept to mark their status row though — we can't write
            // status on behalf of another user (RLS).
            const itemsToSave = incomes.filter(i => i.isMine || unlockedItems.has(i.source_id));
            for (const income of itemsToSave) {
                const amount = parseFloat(amounts[`income-${income.source_id}`] || "0");
                const baseData = {
                    household_id: household.id,
                    income_source_id: income.source_id,
                    month: currentMonth,
                    month_start: startStr,
                    month_end: endStr,
                    amount,
                    // Preserve original creator for items not owned by me;
                    // only stamp my id on my own rows.
                    created_by: income.isMine ? user.id : income.created_by,
                };
                const data = await encryptMonthlyIncome(baseData);
                const { error } = await supabase.from("monthly_incomes").upsert(data, {
                    onConflict: "income_source_id,month",
                });
                if (error) throw error;
            }

            // Mark me as accepted, plus the owners of any items I unlocked
            // (we're reviewing together — they don't need to log in again).
            const unlockedOwners = incomes
                .filter(i => unlockedItems.has(i.source_id) && !i.isMine)
                .map(i => i.created_by);
            const acceptedUserIds = Array.from(new Set([user.id, ...unlockedOwners]));
            await writeStatus("income", acceptedUserIds);

            toast.success("Income accepted");
            // Clear unlocked-items state — they've been saved + accepted
            setUnlockedItems(new Set());
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
    const myIncomeCount = incomes.filter(i => i.isMine).length;
    const finalizerName = isFinalized
        ? members.find(m => m.user_id === finalizedRow!.user_id)?.profiles?.full_name || "A household member"
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-primary" /> Monthly Review
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
                                Finalized by {finalizerName} on {format(new Date(finalizedRow!.accepted_at), "MMM d, HH:mm")}.
                                Use the Income or Expenses page to make corrections.
                            </AlertDescription>
                        </AlertContent>
                    </Alert>
                )}

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "income" | "expenses")} className="flex-1 overflow-hidden flex flex-col">
                    <TabsList>
                        <TabsTrigger value="income" className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Income
                            {myIncomeAccepted && <Check className="h-3 w-3 text-success" />}
                        </TabsTrigger>
                        <TabsTrigger value="expenses" className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            Expenses
                            {expensesVerified && <Check className="h-3 w-3 text-success" />}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="income" className="flex-1 overflow-y-auto mt-4 space-y-2">
                        {incomes.map(item => {
                            const ownerMember = members.find(m => m.user_id === item.created_by);
                            const ownerName = ownerMember?.profiles?.full_name || (item.isMine ? "You" : "Other member");
                            const ownerInitials = ownerName.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                            const isUnlocked = unlockedItems.has(item.source_id);
                            const editable = !isFinalized && (item.isMine || isUnlocked);
                            const showsLockButton = !item.isMine && !isFinalized;
                            return (
                                <div key={item.source_id} className={`flex items-center gap-3 p-3 rounded-lg border bg-background/50 ${editable ? 'border-border' : 'border-border/40'} ${!item.isMine && !isUnlocked ? 'opacity-70' : ''}`}>
                                    <Avatar className="h-8 w-8 flex-shrink-0" title={item.isMine ? "Your income" : ownerName}>
                                        {ownerMember?.profiles?.avatar_url && (
                                            <AvatarImage src={ownerMember.profiles.avatar_url} alt={ownerName} />
                                        )}
                                        <AvatarFallback className="text-[10px] font-medium">{ownerInitials}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                        <span className="text-sm font-medium truncate" title={item.name}>{item.name}</span>
                                        {showsLockButton && (
                                            <button
                                                type="button"
                                                onClick={() => toggleUnlock(item.source_id)}
                                                className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${isUnlocked ? 'bg-warning/20 text-warning hover:bg-warning/30' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                                                title={isUnlocked ? `Lock — ${ownerName}'s value still saves` : `Unlock to enter ${ownerName}'s value`}
                                                aria-label={isUnlocked ? "Lock item" : "Unlock to edit"}
                                            >
                                                {isUnlocked ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <input
                                            type="number"
                                            disabled={!editable}
                                            value={amounts[`income-${item.source_id}`] || "0"}
                                            onChange={(e) => handleAmountChange(`income-${item.source_id}`, e.target.value)}
                                            className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:cursor-not-allowed ${Math.abs(parseFloat(amounts[`income-${item.source_id}`] || "0") - item.defaultAmount) < 0.01
                                                ? 'border-success'
                                                : 'border-warning'
                                                }`}
                                        />
                                        <span className="text-sm text-muted-foreground w-10">{currency}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {incomes.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">No income sources configured for this household.</p>
                        )}
                    </TabsContent>

                    <TabsContent value="expenses" className="flex-1 overflow-y-auto mt-4 space-y-2">
                        {expenses.map(item => {
                            const cat = item.category ? getCategoryById(item.category) : null;
                            const Icon = cat?.icon;
                            return (
                                <div key={item.expense_id} className="flex items-center justify-between p-3 rounded-lg border border-line bg-surface">
                                    <div className="flex items-center gap-3">
                                        <CatIcon icon={Icon || Sparkles} hue={cat?.hue} size={28} />
                                        <span className="text-sm font-medium">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            disabled={isFinalized}
                                            value={amounts[`expense-${item.expense_id}`] || "0"}
                                            onChange={(e) => handleAmountChange(`expense-${item.expense_id}`, e.target.value)}
                                            className={`w-24 text-right text-lg font-semibold bg-transparent border-0 border-b-2 focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:cursor-not-allowed ${Math.abs(parseFloat(amounts[`expense-${item.expense_id}`] || "0") - item.defaultAmount) < 0.01
                                                ? 'border-success'
                                                : 'border-warning'
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
                        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/40 text-xs">
                            <span className="text-muted-foreground font-medium">Income</span>
                            <div className="flex items-center gap-1.5">
                                {members.map(m => {
                                    const accepted = incomeAcceptedUserIds.has(m.user_id);
                                    const name = m.profiles?.full_name || "Member";
                                    const initials = name.split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
                                    return (
                                        <div key={m.user_id} className="relative" title={`${name} — ${accepted ? "accepted" : "pending"}`}>
                                            <Avatar className="h-7 w-7">
                                                {m.profiles?.avatar_url && <AvatarImage src={m.profiles.avatar_url} alt={name} />}
                                                <AvatarFallback className="text-[9px] font-medium">{initials}</AvatarFallback>
                                            </Avatar>
                                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${accepted ? "bg-success" : "bg-warning"}`} />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="h-5 w-px bg-border/60 mx-1" />
                            <span className="text-muted-foreground font-medium">Expenses</span>
                            <span
                                className={`h-3 w-3 rounded-full ${expensesVerified ? "bg-success" : "bg-warning"}`}
                                title={expensesVerified ? "Verified" : "Pending"}
                            />
                            <button
                                type="button"
                                onClick={manualRefresh}
                                disabled={refreshing}
                                className="ml-auto h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/70 transition-colors flex-shrink-0 disabled:opacity-50"
                                title="Refresh — pull the latest from the server"
                                aria-label="Refresh"
                            >
                                <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                            </button>
                        </div>

                        {activeTab === "income" ? (
                            <div className="space-y-1">
                                <Button
                                    onClick={acceptIncome}
                                    disabled={savingScope !== null || (myIncomeCount === 0 && unlockedItems.size === 0)}
                                    className="w-full"
                                    size="lg"
                                    variant={myIncomeAccepted ? "outline" : "default"}
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    {savingScope === "income"
                                        ? "Saving..."
                                        : myIncomeAccepted
                                            ? unlockedItems.size > 0 ? "Re-accept incomes" : "Re-accept my income"
                                            : unlockedItems.size > 0 && myIncomeCount === 0
                                                ? "Save edits"
                                                : unlockedItems.size > 0
                                                    ? "Accept incomes"
                                                    : "Accept my income"}
                                </Button>
                                {unlockedItems.size > 0 && (
                                    <p className="text-[11px] text-muted-foreground text-center">
                                        You'll also accept on behalf of the unlocked income{unlockedItems.size > 1 ? "s" : ""}.
                                    </p>
                                )}
                            </div>
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

                        {canFinalize && (
                            <>
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

                                <Button
                                    onClick={finalize}
                                    disabled={!confirmFinalize || savingScope !== null}
                                    className="w-full"
                                    size="lg"
                                >
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    {savingScope === "finalized" ? "Finalizing..." : "Finalize review"}
                                </Button>
                            </>
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
