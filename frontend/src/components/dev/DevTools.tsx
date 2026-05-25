import { useState, useRef } from "react";
import { format } from "date-fns";
import { Wrench, X, RotateCcw, Clock, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNow, getDevToday, setDevToday, isDev } from "@/utils/devTime";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { getCurrentFinancialMonth, formatFinancialMonth } from "@/utils/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Sensitive (encrypted) fields per source table: plaintext key → encrypted column.
const SENSITIVE: Record<string, Record<string, string>> = {
    income_sources: { name: "encrypted_name", provider: "encrypted_provider", budget: "encrypted_budget" },
    expenses: { name: "encrypted_name", budget: "encrypted_budget" },
    subscriptions: { name: "encrypted_name", service: "encrypted_service", budget: "encrypted_budget" },
    insurances: { name: "encrypted_name", provider: "encrypted_provider", budget: "encrypted_budget" },
    credit_cards: { name: "encrypted_name", monthly_limit: "encrypted_monthly_limit" },
};

// Structural (non-sensitive) columns carried verbatim per table.
const STRUCTURAL: Record<string, string[]> = {
    income_sources: ["is_active", "is_shared", "co_parent_id", "share_percentage", "tax_type", "custom_tax_rate", "category"],
    expenses: ["is_active", "sort_order", "is_credit", "credit_card_id", "category", "subject_id", "member_id", "metadata", "icon"],
    subscriptions: ["billing_cycle", "billing_month", "billing_day", "is_active", "category", "subject_id", "member_id"],
    insurances: ["billing_cycle", "billing_month", "billing_day", "is_active", "is_shared", "co_parent_id", "share_percentage", "category", "subject_id", "member_id"],
    credit_cards: ["is_active"],
};

const EXPORT_VERSION = 1;

export const DevTools = () => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState(() => {
        const stored = getDevToday();
        if (stored) return stored.slice(0, 10);
        return format(new Date(), "yyyy-MM-dd");
    });
    const fileRef = useRef<HTMLInputElement>(null);

    const { household, members, financialMonthStart } = useHousehold();
    const { encrypt, decrypt, isUnlocked } = useEncryption();
    const current = getDevToday();
    const isOverridden = !!current;

    if (!isDev()) return null;

    const applyTime = () => {
        if (!draft) return;
        setDevToday(draft);
        window.location.reload();
    };
    const resetTime = () => {
        setDevToday(null);
        window.location.reload();
    };

    // Time-travel testing can finalize a review for a month that hasn't really
    // started yet, leaving a monthly_review_finalized row that suppresses the
    // banner once real time catches up. This wipes review state so it re-shows.
    const handleResetReview = async () => {
        if (!household) {
            toast.error("No household");
            return;
        }
        setBusy(true);
        try {
            const { error } = await supabase
                .from("monthly_review_finalized")
                .delete()
                .eq("household_id", household.id);
            if (error) throw error;
            toast.success("Review state reset");
            window.location.reload();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to reset review state");
        } finally {
            setBusy(false);
        }
    };

    const handleExport = async () => {
        if (!household || !isUnlocked) {
            toast.error("Unlock the vault first");
            return;
        }
        setBusy(true);
        try {
            const hid = household.id;
            const [subjects, coParents, incomes, expenses, subs, insurances, cards] = await Promise.all([
                supabase.from("subjects").select("*").eq("household_id", hid),
                supabase.from("co_parents").select("*").eq("household_id", hid),
                supabase.from("income_sources").select("*").eq("household_id", hid).is("archived_at", null),
                supabase.from("expenses").select("*").eq("household_id", hid).is("archived_at", null),
                supabase.from("subscriptions").select("*").eq("household_id", hid).is("archived_at", null),
                supabase.from("insurances").select("*").eq("household_id", hid).is("archived_at", null),
                supabase.from("credit_cards").select("*").eq("household_id", hid),
            ]);

            const memberUserById = new Map((members || []).map(m => [m.id, m.user_id]));

            // Decrypt sensitive columns → plaintext, keep structural, drop env-specific.
            const pack = async (rows: Record<string, unknown>[] | null, table: string) => {
                const sens = SENSITIVE[table];
                const struct = STRUCTURAL[table];
                return Promise.all((rows || []).map(async (row) => {
                    const out: Record<string, unknown> = { id: row.id };
                    for (const key of struct) out[key] = row[key] ?? null;
                    for (const [plain, enc] of Object.entries(sens)) {
                        out[plain] = row[enc] ? await decrypt(row[enc] as string) : null;
                    }
                    if (table === "income_sources") out.owner_id = row.owner_id;
                    // member_id → resolve to user_id so import can remap into the new household.
                    if ("member_id" in row && row.member_id) {
                        out._member_user_id = memberUserById.get(row.member_id as string) ?? null;
                    }
                    return out;
                }));
            };

            const data = {
                version: EXPORT_VERSION,
                exportedAt: new Date().toISOString(),
                household: { name: household.name, currency: household.currency, financial_month_start: financialMonthStart },
                subjects: (subjects.data || []).map((s) => ({ id: s.id, name: s.name, type: s.type, sort_order: s.sort_order, user_id: s.user_id })),
                co_parents: (coParents.data || []).map((c) => ({ id: c.id, name: c.name, notes: c.notes })),
                income_sources: await pack(incomes.data as Record<string, unknown>[] | null, "income_sources"),
                expenses: await pack(expenses.data as Record<string, unknown>[] | null, "expenses"),
                subscriptions: await pack(subs.data as Record<string, unknown>[] | null, "subscriptions"),
                insurances: await pack(insurances.data as Record<string, unknown>[] | null, "insurances"),
                credit_cards: await pack(cards.data as Record<string, unknown>[] | null, "credit_cards"),
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `hh-data-${(household.name || "household").replace(/\s+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Exported financial data");
        } catch (err) {
            console.error("Export failed:", err);
            toast.error(err instanceof Error ? err.message : "Export failed");
        } finally {
            setBusy(false);
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !household) return;
        if (!isUnlocked) { toast.error("Unlock the vault first"); return; }
        if (!window.confirm("Import will ADD these items to the current household. Continue?")) return;

        setBusy(true);
        try {
            const data = JSON.parse(await file.text());
            const hid = household.id;
            const uid = (await supabase.auth.getUser()).data.user?.id;
            if (!uid) throw new Error("Not authenticated");

            // 1. Subjects + co_parents first → build old→new id maps.
            const subjectMap = new Map<string, string>();
            for (const s of data.subjects || []) {
                const { data: inserted, error } = await supabase.from("subjects")
                    .insert({ household_id: hid, name: s.name, type: s.type, sort_order: s.sort_order ?? 0, user_id: s.user_id ?? null })
                    .select("id").single();
                if (error) throw error;
                subjectMap.set(s.id, inserted.id);
            }
            const coParentMap = new Map<string, string>();
            for (const c of data.co_parents || []) {
                const { data: inserted, error } = await supabase.from("co_parents")
                    .insert({ household_id: hid, name: c.name, notes: c.notes ?? null })
                    .select("id").single();
                if (error) throw error;
                coParentMap.set(c.id, inserted.id);
            }
            const cardMap = new Map<string, string>();
            for (const c of data.credit_cards || []) {
                const row = await encryptRow(c, "credit_cards", { household_id: hid, created_by: uid, is_active: c.is_active ?? true });
                const { data: inserted, error } = await supabase.from("credit_cards").insert(row as TablesInsert<"credit_cards">).select("id").single();
                if (error) throw error;
                cardMap.set(c.id, inserted.id);
            }

            // user_id → current household_members.id, for member attribution remap.
            const memberIdByUser = new Map((members || []).map(m => [m.user_id, m.id]));
            const validUserIds = new Set((members || []).map(m => m.user_id));
            const remapMember = (item: Record<string, unknown>) => item._member_user_id ? (memberIdByUser.get(item._member_user_id as string) ?? null) : null;

            // 2. Income sources.
            for (const it of data.income_sources || []) {
                const owner = validUserIds.has(it.owner_id) ? it.owner_id : uid;
                const row = await encryptRow(it, "income_sources", {
                    household_id: hid,
                    owner_id: owner,
                    is_active: it.is_active ?? true,
                    is_shared: it.is_shared ?? false,
                    co_parent_id: it.co_parent_id ? (coParentMap.get(it.co_parent_id) ?? null) : null,
                    share_percentage: it.share_percentage ?? 50,
                    tax_type: it.tax_type,
                    custom_tax_rate: it.custom_tax_rate ?? null,
                    category: it.category,
                });
                const { error } = await supabase.from("income_sources").insert(row as TablesInsert<"income_sources">);
                if (error) throw error;
            }

            // 3. Expenses.
            for (const it of data.expenses || []) {
                const row = await encryptRow(it, "expenses", {
                    household_id: hid,
                    created_by: uid,
                    is_active: it.is_active ?? true,
                    sort_order: it.sort_order ?? 0,
                    is_credit: it.is_credit ?? false,
                    credit_card_id: it.credit_card_id ? (cardMap.get(it.credit_card_id) ?? null) : null,
                    category: it.category,
                    subject_id: it.subject_id ? (subjectMap.get(it.subject_id) ?? null) : null,
                    member_id: remapMember(it),
                    metadata: it.metadata ?? null,
                    icon: it.icon ?? null,
                });
                const { error } = await supabase.from("expenses").insert(row as TablesInsert<"expenses">);
                if (error) throw error;
            }

            // 4. Subscriptions.
            for (const it of data.subscriptions || []) {
                const row = await encryptRow(it, "subscriptions", {
                    household_id: hid,
                    created_by: uid,
                    billing_cycle: it.billing_cycle ?? "monthly",
                    billing_month: it.billing_month ?? null,
                    billing_day: it.billing_day ?? null,
                    is_active: it.is_active ?? true,
                    category: it.category,
                    subject_id: it.subject_id ? (subjectMap.get(it.subject_id) ?? null) : null,
                    member_id: remapMember(it),
                });
                const { error } = await supabase.from("subscriptions").insert(row as TablesInsert<"subscriptions">);
                if (error) throw error;
            }

            // 5. Insurances.
            for (const it of data.insurances || []) {
                const row = await encryptRow(it, "insurances", {
                    household_id: hid,
                    created_by: uid,
                    billing_cycle: it.billing_cycle ?? "yearly",
                    billing_month: it.billing_month ?? null,
                    billing_day: it.billing_day ?? null,
                    is_active: it.is_active ?? true,
                    is_shared: it.is_shared ?? false,
                    co_parent_id: it.co_parent_id ? (coParentMap.get(it.co_parent_id) ?? null) : null,
                    share_percentage: it.share_percentage ?? 50,
                    category: it.category,
                    subject_id: it.subject_id ? (subjectMap.get(it.subject_id) ?? null) : null,
                    member_id: remapMember(it),
                });
                const { error } = await supabase.from("insurances").insert(row as TablesInsert<"insurances">);
                if (error) throw error;
            }

            toast.success("Imported — reloading…");
            setTimeout(() => window.location.reload(), 800);
        } catch (err) {
            console.error("Import failed:", err);
            toast.error(err instanceof Error ? err.message : "Import failed");
        } finally {
            setBusy(false);
        }
    };

    // Encrypt the sensitive fields of an item and merge with the structural base.
    const encryptRow = async (item: Record<string, unknown>, table: string, base: Record<string, unknown>) => {
        const row: Record<string, unknown> = { ...base, is_encrypted: true };
        for (const [plain, enc] of Object.entries(SENSITIVE[table])) {
            const value = item[plain];
            row[enc] = (value !== undefined && value !== null && value !== "")
                ? await encrypt(String(value))
                : null;
        }
        return row;
    };

    const effectiveNow = getNow();
    const fm = getCurrentFinancialMonth(financialMonthStart);

    return (
        <div className="hidden sm:block fixed bottom-4 right-4 z-50">
            {open ? (
                <div className="w-72 rounded-xl border border-line bg-surface shadow-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5" /> Dev tools
                        </span>
                        <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Time travel */}
                    <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1.5 text-ink"><Clock className="h-3.5 w-3.5" /> Time travel</Label>
                        <Input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 text-sm" />
                        <p className="text-[11px] text-muted">
                            Now: {format(effectiveNow, "MMM d, yyyy")} · {formatFinancialMonth(fm, financialMonthStart)}
                            {isOverridden && <span className="text-warn"> (overridden)</span>}
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={applyTime} className="flex-1 h-8">Apply</Button>
                            {isOverridden && (
                                <Button size="sm" variant="outline" onClick={resetTime} className="h-8">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Review state */}
                    <div className="space-y-2 border-t border-line pt-3">
                        <Label className="text-xs text-ink">Review state</Label>
                        <p className="text-[11px] text-muted">Clears finalized reviews so the banner re-shows. Fixes time-travel pollution.</p>
                        <Button size="sm" variant="outline" disabled={busy} onClick={handleResetReview} className="w-full h-8">
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset review state
                        </Button>
                    </div>

                    {/* Data export / import */}
                    <div className="space-y-2 border-t border-line pt-3">
                        <Label className="text-xs text-ink">Financial data</Label>
                        <p className="text-[11px] text-muted">Items only — monthly history isn't portable.</p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={busy} onClick={handleExport} className="flex-1 h-8">
                                <Download className="h-3.5 w-3.5 mr-1.5" /> Export
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="flex-1 h-8">
                                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
                            </Button>
                        </div>
                        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="h-9 px-3 rounded-full border border-line bg-surface shadow-lg text-xs font-semibold text-muted hover:text-ink flex items-center gap-1.5"
                >
                    <Wrench className="h-3.5 w-3.5" /> DEV
                </button>
            )}
        </div>
    );
};
