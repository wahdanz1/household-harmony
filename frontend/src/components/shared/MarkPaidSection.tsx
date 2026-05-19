import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryptedFields, monthlyIncomeFields } from "@/hooks/useEncryptedFields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

interface MonthlyRow {
    id: string;
    actual_amount?: number | null;
    actual_recorded_at?: string | null;
    budget_snapshot?: number | null;
}

interface MarkPaidSectionProps {
    sourceId: string;
    householdId: string;
    table: "monthly_incomes" | "monthly_expenses";
    fkColumn: "income_source_id" | "expense_id";
    currency: string;
    financialMonthStart: number;
}

type EncryptedActualUpdate = {
    encrypted_actual_amount: string | null;
};

export const MarkPaidSection = ({
    sourceId,
    householdId,
    table,
    fkColumn,
    currency,
    financialMonthStart,
}: MarkPaidSectionProps) => {
    const { user } = useAuth();
    // Both monthly_* tables share the same field shape.
    const { encryptRecord, decryptRecord } = useEncryptedFields(monthlyIncomeFields);

    const [expanded, setExpanded] = useState(false);
    const [monthlyRow, setMonthlyRow] = useState<MonthlyRow | null>(null);
    const [actualValue, setActualValue] = useState("");
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const todayMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start, end } = getFinancialMonthRange(todayMonth, financialMonthStart);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    const monthLabel = format(end, "MMMM yyyy");

    useEffect(() => {
        let cancelled = false;
        const fetchRow = async () => {
            const { data } = await supabase
                .from(table)
                .select("*")
                .eq("household_id", householdId)
                .eq(fkColumn, sourceId)
                .gte("month_end", startStr)
                .lte("month_start", endStr)
                .maybeSingle();
            if (cancelled) return;
            if (data) {
                const decrypted = await decryptRecord(data) as MonthlyRow;
                if (cancelled) return;
                setMonthlyRow(decrypted);
                if (decrypted.actual_amount != null) {
                    setActualValue(decrypted.actual_amount.toString());
                } else if (decrypted.budget_snapshot != null) {
                    setActualValue(decrypted.budget_snapshot.toString());
                }
            }
            setLoaded(true);
        };
        fetchRow();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceId, householdId, table]);

    if (!loaded || !monthlyRow) return null;

    const recorded = monthlyRow.actual_recorded_at != null;
    const recordedDate = recorded ? format(new Date(monthlyRow.actual_recorded_at!), "d MMM") : null;
    const recordedAmount = recorded ? Number(monthlyRow.actual_amount) : null;

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        const encrypted = await encryptRecord({
            actual_amount: parseFloat(actualValue || "0"),
        }) as EncryptedActualUpdate;
        const { error } = await supabase
            .from(table)
            .update({
                encrypted_actual_amount: encrypted.encrypted_actual_amount,
                actual_recorded_at: new Date().toISOString(),
            })
            .eq("id", monthlyRow.id);
        if (!error) {
            setMonthlyRow({
                ...monthlyRow,
                actual_amount: parseFloat(actualValue || "0"),
                actual_recorded_at: new Date().toISOString(),
            });
            setExpanded(false);
        }
        setSaving(false);
    };

    const handleClear = async () => {
        setSaving(true);
        const { error } = await supabase
            .from(table)
            .update({
                encrypted_actual_amount: null,
                actual_recorded_at: null,
            })
            .eq("id", monthlyRow.id);
        if (!error) {
            setMonthlyRow({
                ...monthlyRow,
                actual_amount: null,
                actual_recorded_at: null,
            });
            setActualValue(monthlyRow.budget_snapshot?.toString() ?? "");
        }
        setSaving(false);
    };

    if (recorded) {
        return (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-line-2">
                <div className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent" />
                    <span>
                        Recorded {recordedDate} · <Money v={recordedAmount ?? 0} currency={currency} className="inline" />
                    </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving}>
                    Clear
                </Button>
            </div>
        );
    }

    return (
        <div className="pt-2 border-t border-line-2">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full text-left text-sm font-medium"
            >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span>Mark paid for {monthLabel}</span>
            </button>
            {expanded && (
                <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted">
                        Already paid? Enter the actual amount. We'll log it as recorded for {monthLabel} so you don't have to do it in the next Monthly Review.
                    </p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            inputMode="numeric"
                            value={actualValue}
                            onChange={(e) => setActualValue(e.target.value)}
                            placeholder="0"
                        />
                        <Button onClick={handleSave} disabled={saving || !actualValue.trim()}>
                            {saving ? "Saving…" : "Record"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
