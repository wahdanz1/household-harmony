import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { FileUp, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useEncryptedFields, creditCardFields } from "@/hooks/useEncryptedFields";
import { ParsedTransactionsReview } from "@/components/expenses/credit/ParsedTransactionsReview";

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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ImportStatementStepProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
}

export const ImportStatementStep = ({ householdId, currency, monthStart, monthEnd }: ImportStatementStepProps) => {
    const { user } = useAuth();
    const { household } = useHousehold();
    const { decryptRecords: decryptCreditCards } = useEncryptedFields(creditCardFields);
    const [cards, setCards] = useState<any[]>([]);
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ackKey = `hh_credit_privacy_ack_${householdId}`;
    const [ackd, setAckd] = useState(
        () => typeof window !== "undefined" && localStorage.getItem(ackKey) === "1",
    );

    useEffect(() => {
        const fetchCards = async () => {
            const { data } = await supabase
                .from("credit_cards")
                .select("*")
                .eq("household_id", householdId)
                .eq("is_active", true);
            const decrypted = await decryptCreditCards(data || []);
            setCards(decrypted.map((c: any) => ({ ...c, monthly_limit: Number(c.monthly_limit || 0) })));
        };
        if (householdId) fetchCards();
    }, [householdId]);

    const handleAck = () => {
        localStorage.setItem(ackKey, "1");
        setAckd(true);
    };

    const handleFileSelect = async (file: File) => {
        if (!user || !household) return;

        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            toast.error("PDF too large (max 10MB)");
            return;
        }

        setParsing(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                toast.error("Authentication required. Please log in again.");
                setParsing(false);
                return;
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("household_id", household.id);

            const response = await fetch(`${API_BASE_URL}/api/llm/parse-invoice`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.detail || "Unknown error";
                switch (response.status) {
                    case 401: toast.error("Add an LLM API key in Settings to use this feature."); break;
                    case 413: toast.error("PDF too large (max 10MB)"); break;
                    case 429: toast.error("Rate limit reached — wait 60 seconds and try again."); break;
                    case 500: toast.error("Processing failed — please try again."); break;
                    default: toast.error(errorMsg);
                }
                setParsing(false);
                return;
            }

            const result: ParseResult = await response.json();
            setParseResult(result);

            const cachedNote = result.cached ? " (cached)" : "";
            toast.success(`Found ${result.transactions.length} transactions in ${(result.duration_ms / 1000).toFixed(1)}s${cachedNote}`);
        } catch (err: any) {
            if (err.message === "Failed to fetch" || err.name === "TypeError") {
                toast.error("Invoice parsing service is currently unavailable. Please try again later.");
            } else {
                toast.error(err.message || "Failed to parse PDF invoice");
            }
        } finally {
            setParsing(false);
        }
    };

    if (cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-10 px-6 gap-3">
                <p className="text-sm font-medium text-ink">No credit cards yet</p>
                <p className="text-sm text-muted max-w-sm">
                    Add a credit card in Settings → Household → Credit cards to import statements during Monthly Review.
                </p>
            </div>
        );
    }

    if (parseResult) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="soft">{parseResult.language}</Badge>
                        <Badge variant="outline" className="text-xs">{parseResult.provider_used}</Badge>
                        {parseResult.cached && <Badge variant="success" className="text-xs">cached</Badge>}
                    </div>
                    <span className="text-[10px] text-muted uppercase font-bold">{(parseResult.duration_ms / 1000).toFixed(1)}s</span>
                </div>
                <ParsedTransactionsReview
                    transactions={parseResult.transactions}
                    creditCards={cards}
                    householdId={householdId}
                    currency={currency}
                    monthStart={monthStart}
                    monthEnd={monthEnd}
                    onAccept={() => setParseResult(null)}
                    onCancel={() => setParseResult(null)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <p className="font-medium text-ink">
                    Reconcile {format(monthStart, "MMM yyyy")} actuals
                </p>
                <p className="text-muted mt-1">
                    Upload the credit-card statement for the period roughly covering this financial month.
                    Categorized totals fill in actuals for the rows you marked as credit-paid. Your plan stays untouched.
                </p>
            </div>

            {!ackd && (
                <Alert variant="warning">
                    <ShieldCheck />
                    <AlertContent>
                        <AlertTitle>Statement leaves your device for parsing</AlertTitle>
                        <AlertDescription>
                            The PDF is sent to a third-party AI service (Groq or Gemini) to extract transactions.
                            Only per-category totals come back, encrypted with your vault.
                            Raw PDFs and individual transactions are not retained by Household Harmony.
                        </AlertDescription>
                    </AlertContent>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={handleAck}>
                        Got it
                    </Button>
                </Alert>
            )}

            <div className="flex items-center justify-center py-6">
                <Button
                    variant="accentSoft"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsing || !ackd}
                >
                    {parsing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Parsing PDF...</>
                    ) : (
                        <><FileUp className="h-4 w-4" /> Import statement</>
                    )}
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                        e.target.value = "";
                    }}
                    accept=".pdf"
                    className="hidden"
                />
            </div>
        </div>
    );
};
