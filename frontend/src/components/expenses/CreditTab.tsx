import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CreditCardManagement } from "./credit/CreditCardManagement";
import { CreditCard as CreditCardIcon, Check } from "lucide-react";
import { getCategoryById } from "@/constants/expenseCategories";
import { ExpenseBlock } from "./AllTabBlockView";
import { useEncryptedFields, expenseFields, monthlyExpenseFields, creditCardFields } from "@/hooks/useEncryptedFields";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { useEncryption } from "@/contexts/EncryptionContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Loader2 } from "lucide-react";
import { ParsedTransactionsReview } from "./credit/ParsedTransactionsReview";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";
import { CreditTabSkeleton } from "@/components/shared/skeletons/PageSkeletons";

// Backend API response type
interface ParseResult {
    language: "Swedish" | "English";
    transactions: Array<{
        date: string;
        merchant: string;
        amount: number;
        category: string;
        confidence: "HIGH" | "MEDIUM" | "LOW";
    }>;
    provider_used: "groq" | "gemini";
    duration_ms: number;
    cached: boolean;
}

// Backend API URL (local dev or Railway)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// CreditCardExpense interface removed - credit expenses now use expenses table with is_credit=true

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
    actual_amount?: number;
}

interface CreditTabProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
}

export const CreditTab = ({ householdId, currency, monthStart, monthEnd }: CreditTabProps) => {
    const { user } = useAuth();
    const { household } = useHousehold();
    const { isUnlocked, decrypt, encrypt } = useEncryption();
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    // Credit expenses now use expenses table with is_credit=true (tracked via budgetedCredit)
    const [budgetedCredit, setBudgetedCredit] = useState<BudgetedCreditExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [budgetExpanded, setBudgetExpanded] = useState(true);
    const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [addCardOpen, setAddCardOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { decryptRecords: decryptExpenses, encryptRecord: encryptMonthlyExpense } = useEncryptedFields(expenseFields);
    const { decryptRecords: decryptMonthlyExpenses } = useEncryptedFields(monthlyExpenseFields);
    // creditCardExpenseFields removed - credit expenses now use expenses table
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
            { data: creditCategoriesData },
            { data: monthlyData },
        ] = await Promise.all([
            supabase.from("credit_cards").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("expenses").select("*").eq("household_id", householdId).eq("is_active", true).eq("is_credit", true),
            supabase.from("monthly_expenses").select("*").eq("household_id", householdId).gte("month_end", startStr).lte("month_start", endStr),
        ]);

        const decryptedCardsRaw = await decryptCreditCards(cardsData || []);
        // Ensure monthly_limit is a number
        const decryptedCards = decryptedCardsRaw.map((card: any) => ({
            ...card,
            monthly_limit: Number(card.monthly_limit || 0)
        }));
        setCreditCards(decryptedCards);

        // Build budgeted credit items from expenses with is_credit=true
        if (creditCategoriesData && creditCategoriesData.length > 0) {
            const decryptedCategories = await decryptExpenses(creditCategoriesData);
            const decryptedMonthly = await decryptMonthlyExpenses(monthlyData || []);

            const budgetItems: BudgetedCreditExpense[] = decryptedCategories.map((cat: any) => {
                const monthly = decryptedMonthly.find((m: any) => m.expense_id === cat.id);
                const budget =
                    monthly?.budget_amount ??
                    monthly?.amount ??
                    cat.default_amount ??
                    0;
                const actual = monthly?.actual_amount;
                return {
                    id: cat.id,
                    name: cat.name,
                    category: cat.category,
                    default_amount: cat.default_amount || 0,
                    monthly_amount: budget,
                    actual_amount: actual !== undefined && actual !== null ? Number(actual) : undefined,
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
                budget_amount: amount,
                created_by: user.id,
            };

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

    // calculateCardTotal removed - credit expenses now tracked via budgeted items
    // Card spending will be calculated from monthly_expenses linked to is_credit expenses

    // Calculate total from edited amounts
    const totalBudgetedCredit = Object.values(editedAmounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

    const handleFileSelect = async (file: File) => {
        if (!user || !isUnlocked || !household) return;

        // File size validation (10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            toast.error("PDF too large (max 10MB)");
            return;
        }

        setParsing(true);
        try {
            // Get session for auth header
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            if (!token) {
                toast.error("Authentication required. Please log in again.");
                setParsing(false);
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('household_id', household.id);

            const response = await fetch(
                `${API_BASE_URL}/api/llm/parse-invoice`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            // Handle specific error codes
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.detail || 'Unknown error';

                switch (response.status) {
                    case 401:
                        toast.error("Add LLM API key in Settings to use this feature.");
                        break;
                    case 413:
                        toast.error("PDF too large (max 10MB)");
                        break;
                    case 429:
                        toast.error("Rate limit reached - wait 60 seconds and try again.");
                        break;
                    case 500:
                        toast.error("Processing failed - please try again.");
                        break;
                    default:
                        toast.error(errorMsg);
                }
                setParsing(false);
                return;
            }

            const result: ParseResult = await response.json();
            setParseResult(result);

            const cachedNote = result.cached ? " (cached)" : "";
            toast.success(
                `Found ${result.transactions.length} transactions! Parsed with ${result.provider_used} in ${(result.duration_ms / 1000).toFixed(1)}s${cachedNote}`
            );
        } catch (err: any) {
            console.error("PDF Parsing failed:", err);

            // Network error (backend down)
            if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
                toast.error("Invoice parsing service is currently unavailable. Please try again later.");
            } else {
                toast.error(err.message || "Failed to parse PDF invoice");
            }
        } finally {
            setParsing(false);
        }
    };

    if (loading) {
        return <CreditTabSkeleton />;
    }

    if (!isUnlocked) {
        return <VaultLockedAlert className="mt-6" />;
    }

    if (creditCards.length === 0) {
        return (
            <div className="space-y-6">
                <EmptyStateCard
                    icon={CreditCardIcon}
                    iconClassName="text-accent-purple"
                    headline="No credit cards yet"
                    description="Add a credit card to import its monthly invoice and have categories filled in for you."
                    primaryLabel="Add your first credit card"
                    onPrimary={() => setAddCardOpen(true)}
                    hideWizardLink
                />
                <CreditCardManagement
                    householdId={householdId}
                    currency={currency}
                    creditCards={creditCards}
                    onUpdate={fetchData}
                    addOpen={addCardOpen}
                    onAddOpenChange={setAddCardOpen}
                    dialogOnly
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="flex items-center gap-2">
                            <FileUp className="h-5 w-5 text-info" />
                            Import credit card invoice
                        </h3>
                        <p className="text-sm text-muted-foreground">Upload your monthly statement to fill in actuals.</p>
                    </div>
                    <Button
                        variant="accentSoft"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={parsing}
                    >
                        {parsing ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Parsing PDF...</>
                        ) : (
                            <><FileUp className="h-4 w-4" /> Import PDF</>
                        )}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                            e.target.value = '';
                        }}
                        accept=".pdf"
                        className="hidden"
                    />
                </div>

                {parseResult && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="mb-2 flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Badge variant="soft">
                                    {parseResult.language}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    {parseResult.provider_used}
                                </Badge>
                                {parseResult.cached && (
                                    <Badge variant="success" className="text-xs">
                                        cached
                                    </Badge>
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                {(parseResult.duration_ms / 1000).toFixed(1)}s
                            </span>
                        </div>
                        <ParsedTransactionsReview
                            transactions={parseResult.transactions}
                            creditCards={creditCards}
                            householdId={householdId}
                            currency={currency}
                            monthStart={monthStart}
                            monthEnd={monthEnd}
                            onAccept={() => {
                                setParseResult(null);
                                fetchData();
                            }}
                            onCancel={() => setParseResult(null)}
                        />
                    </div>
                )}
            </div>

            {budgetedCredit.length > 0 && (
                <ExpenseBlock
                    title="Credit Card Spend"
                    total={totalBudgetedCredit}
                    currency={currency}
                    icon={<CreditCardIcon className="h-5 w-5 text-accent-purple" />}
                    items={budgetedCredit.map(item => ({
                        id: item.id,
                        name: item.name,
                        amount: parseFloat(editedAmounts[item.id] || "0"),
                        defaultAmount: item.default_amount,
                        actualAmount: item.actual_amount,
                        category: item.category
                    }))}
                    editable={true}
                    onAmountChange={handleAmountChange}
                    colorClass="text-accent-purple"
                    headerMetrics={
                        saveStatus !== 'idle' ? (
                            <div className="flex items-center gap-1 text-xs animate-in fade-in">
                                {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> <span className="text-muted-foreground">Saving...</span></>}
                                {saveStatus === "saved" && <><Check className="h-3 w-3 text-success" /> <span className="text-success">Saved</span></>}
                            </div>
                        ) : undefined
                    }
                />
            )}

            <CreditCardManagement
                householdId={householdId}
                currency={currency}
                creditCards={creditCards}
                calculateCardTotal={() => totalBudgetedCredit}
                onUpdate={fetchData}
            />
        </div>
    );
};
