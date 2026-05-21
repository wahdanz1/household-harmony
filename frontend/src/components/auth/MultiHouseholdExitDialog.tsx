import { useEffect, useMemo, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RowItem } from "@/components/ui/row-item";
import { CatIcon } from "@/components/ui/cat-icon";
import { ServiceIcon } from "@/components/ui/service-icon";
import { Money } from "@/components/ui/money";
import { Loader2, ArrowRight, HandCoins, Home, Repeat, Shield, Sparkles, Car, Baby, PawPrint, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { toast } from "@/hooks/use-toast";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { getCategoryById } from "@/constants/expenseCategories";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";
import { format } from "date-fns";

type SectionKey = "income_sources" | "expenses" | "subscriptions" | "insurances";

interface SectionConfig {
    key: SectionKey;
    title: string;
    sectionIcon: any;
    encryptedCols: string[];
    primaryLabelCol: string;
    fallbackLabelCol?: string;
    amountCol: string;
    authorCol: "created_by" | "owner_id";
    subjectCol: "subject_id" | null;
    coParentCol: "co_parent_id" | null;
}

const SECTIONS: SectionConfig[] = [
    {
        key: "income_sources",
        title: "Income sources",
        sectionIcon: HandCoins,
        encryptedCols: ["encrypted_name", "encrypted_provider", "encrypted_budget"],
        primaryLabelCol: "encrypted_provider",
        fallbackLabelCol: "encrypted_name",
        amountCol: "encrypted_budget",
        authorCol: "owner_id",
        subjectCol: null,
        coParentCol: "co_parent_id",
    },
    {
        key: "expenses",
        title: "Fixed / budgeted expenses",
        sectionIcon: Home,
        encryptedCols: ["encrypted_name", "encrypted_budget"],
        primaryLabelCol: "encrypted_name",
        amountCol: "encrypted_budget",
        authorCol: "created_by",
        subjectCol: "subject_id",
        coParentCol: null,
    },
    {
        key: "subscriptions",
        title: "Subscriptions",
        sectionIcon: Repeat,
        encryptedCols: ["encrypted_name", "encrypted_service", "encrypted_budget"],
        primaryLabelCol: "encrypted_name",
        fallbackLabelCol: "encrypted_service",
        amountCol: "encrypted_budget",
        authorCol: "created_by",
        subjectCol: "subject_id",
        coParentCol: null,
    },
    {
        key: "insurances",
        title: "Insurances",
        sectionIcon: Shield,
        encryptedCols: ["encrypted_name", "encrypted_budget", "encrypted_provider"],
        primaryLabelCol: "encrypted_name",
        fallbackLabelCol: "encrypted_provider",
        amountCol: "encrypted_budget",
        authorCol: "created_by",
        subjectCol: "subject_id",
        coParentCol: "co_parent_id",
    },
];

type ItemKind = "attributed" | "added";

type CollisionResolutionKind = "merge" | "new";

interface SubjectCollision {
    oldSubjectId: string;
    oldName: string;
    type: string;
    existingId: string;
    existingName: string;
}

interface CollisionResolution {
    kind: CollisionResolutionKind;
    /** Used only when kind === "new". Empty falls back to "{oldName} (2)". */
    newName: string;
}

const SUBJECT_TYPE_ICON: Record<string, any> = {
    car: Car,
    kid: Baby,
    pet: PawPrint,
    other: Box,
};

interface FetchedItem {
    id: string;
    raw: Record<string, any>;
    label: string;
    amount: number | null;
    billingCycle: string | null;
    category: string | null;
    subjectId: string | null;
    section: SectionKey;
    kind: ItemKind;
}

function categoryFor(section: SectionKey, category: string | null) {
    if (!category) return { icon: Sparkles, hue: undefined as number | undefined };
    if (section === "income_sources") {
        const c = getIncomeCategoryById(category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    if (section === "subscriptions") {
        const c = subscriptionCategories.find(s => s.value === category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    if (section === "insurances") {
        const c = insuranceTypes.find(s => s.value === category);
        return { icon: c?.icon ?? Sparkles, hue: c?.hue };
    }
    const c = getCategoryById(category);
    return { icon: c?.icon ?? Sparkles, hue: c?.hue };
}

function billingSuffix(cycle: string | null): string {
    if (!cycle || cycle === "monthly") return "";
    if (cycle === "yearly") return "/yr";
    if (cycle === "semi_annually") return "/6mo";
    if (cycle === "quarterly") return "/3mo";
    return `/${cycle}`;
}

export const MultiHouseholdExitDialog = () => {
    const { user } = useAuth();
    const { household: activeHousehold, members: activeMembers, userRole: activeRole, refresh: refreshHousehold } = useHousehold();
    const {
        pendingExitHouseholdId,
        decryptFromPendingExit,
        encrypt,
        clearPendingExitDEK,
        isUnlocked,
    } = useEncryption();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [items, setItems] = useState<FetchedItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [householdName, setHouseholdName] = useState<string | null>(null);
    const [collisions, setCollisions] = useState<SubjectCollision[]>([]);
    const [resolutions, setResolutions] = useState<Record<string, CollisionResolution>>({});
    const [collisionDialogOpen, setCollisionDialogOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pendingBringSubjects, setPendingBringSubjects] = useState<any[] | null>(null);

    const open = !!pendingExitHouseholdId && isUnlocked;

    useEffect(() => {
        if (!open || !pendingExitHouseholdId || !user) return;
        let cancelled = false;

        (async () => {
            setLoading(true);

            const { data: hh } = await supabase
                .from("households")
                .select("name")
                .eq("id", pendingExitHouseholdId)
                .single();
            if (cancelled) return;
            setHouseholdName(hh?.name ?? null);

            const { data: oldMembership } = await supabase
                .from("household_members")
                .select("id")
                .eq("user_id", user.id)
                .eq("household_id", pendingExitHouseholdId)
                .maybeSingle();
            const oldMembershipId = oldMembership?.id ?? null;

            const fetched: FetchedItem[] = [];
            const seenIds = new Set<string>();
            for (const section of SECTIONS) {
                const queries: { kind: ItemKind; build: () => any }[] = [];
                if (section.key === "income_sources") {
                    queries.push({
                        kind: "attributed",
                        build: () => (supabase as any)
                            .from(section.key)
                            .select("*")
                            .eq("household_id", pendingExitHouseholdId)
                            .is("archived_at", null)
                            .eq("owner_id", user.id),
                    });
                } else {
                    if (oldMembershipId) {
                        queries.push({
                            kind: "attributed",
                            build: () => (supabase as any)
                                .from(section.key)
                                .select("*")
                                .eq("household_id", pendingExitHouseholdId)
                                .is("archived_at", null)
                                .eq("member_id", oldMembershipId),
                        });
                    }
                    queries.push({
                        kind: "added",
                        build: () => (supabase as any)
                            .from(section.key)
                            .select("*")
                            .eq("household_id", pendingExitHouseholdId)
                            .is("archived_at", null)
                            .eq(section.authorCol, user.id)
                            .is("member_id", null),
                    });
                }

                for (const { kind, build } of queries) {
                    const { data, error } = await build();
                    if (error || !data) continue;

                    for (const row of data) {
                        if (seenIds.has(row.id)) continue;
                        seenIds.add(row.id);

                        const primaryCipher = row[section.primaryLabelCol];
                        const fallbackCipher = section.fallbackLabelCol ? row[section.fallbackLabelCol] : null;
                        const primary = primaryCipher ? await decryptFromPendingExit(primaryCipher) : null;
                        const fallback = fallbackCipher ? await decryptFromPendingExit(fallbackCipher) : null;
                        const category = row.category ?? null;
                        const label = (primary && primary.trim())
                            || (fallback && fallback.trim())
                            || (section.key === "insurances" ? insuranceTypes.find(t => t.value === category)?.label : null)
                            || "Untitled";

                        const amountCipher = row[section.amountCol];
                        const amountPlain = amountCipher ? await decryptFromPendingExit(amountCipher) : null;
                        const amountNum = amountPlain ? parseFloat(amountPlain) : NaN;

                        fetched.push({
                            id: row.id,
                            raw: row,
                            label,
                            amount: Number.isFinite(amountNum) ? amountNum : null,
                            billingCycle: row.billing_cycle ?? null,
                            category,
                            subjectId: section.subjectCol ? row[section.subjectCol] ?? null : null,
                            section: section.key,
                            kind,
                        });
                    }
                }
            }

            if (cancelled) return;
            setItems(fetched);
            setSelectedIds(new Set(fetched.filter(i => i.kind === "attributed").map(i => i.id)));
            setLoading(false);
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, pendingExitHouseholdId, user?.id, decryptFromPendingExit]);

    const toggleItem = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const itemsBySection = useMemo(() => {
        const m = new Map<SectionKey, FetchedItem[]>();
        for (const s of SECTIONS) m.set(s.key, []);
        for (const item of items) m.get(item.section)?.push(item);
        return m;
    }, [items]);

    const handleConfirm = async () => {
        if (!user || !activeHousehold?.id || !pendingExitHouseholdId) return;
        setSubmitting(true);

        try {
            const subjectIdsToInclude = new Set<string>();
            for (const item of items) {
                if (selectedIds.has(item.id) && item.subjectId) {
                    subjectIdsToInclude.add(item.subjectId);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let oldSubjects: any[] = [];
            if (subjectIdsToInclude.size > 0) {
                const { data } = await supabase
                    .from("subjects")
                    .select("*")
                    .in("id", Array.from(subjectIdsToInclude));
                oldSubjects = data ?? [];
            }

            // Collision detection: a subject of the same type + name (case-
            // insensitive, trimmed) already in the destination means the user
            // needs to tell us if it's the same thing or just shares a name.
            const detected: SubjectCollision[] = [];
            if (oldSubjects.length > 0) {
                const { data: destSubjects } = await supabase
                    .from("subjects")
                    .select("id, name, type")
                    .eq("household_id", activeHousehold.id);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const dest = (destSubjects ?? []) as any[];
                for (const old of oldSubjects) {
                    const oldNorm = (old.name ?? "").trim().toLowerCase();
                    if (!oldNorm) continue;
                    const existing = dest.find(s =>
                        s.type === old.type && (s.name ?? "").trim().toLowerCase() === oldNorm
                    );
                    if (existing) {
                        detected.push({
                            oldSubjectId: old.id,
                            oldName: old.name,
                            type: old.type,
                            existingId: existing.id,
                            existingName: existing.name,
                        });
                    }
                }
            }

            if (detected.length > 0) {
                const defaults: Record<string, CollisionResolution> = {};
                for (const c of detected) {
                    defaults[c.oldSubjectId] = { kind: "merge", newName: `${c.oldName} (2)` };
                }
                setCollisions(detected);
                setResolutions(defaults);
                setPendingBringSubjects(oldSubjects);
                setCollisionDialogOpen(true);
                setSubmitting(false);
                return;
            }

            await proceedWithBring(oldSubjects, {}, []);
        } catch (err: any) {
            console.error("Exit dialog failed:", err);
            toast({
                title: "Couldn't finish",
                description: err?.message ?? "Try again.",
                variant: "destructive",
            });
            setSubmitting(false);
        }
    };

    const handleResolveCollisions = async () => {
        if (!pendingBringSubjects) return;
        const oldSubjects = pendingBringSubjects;
        const detected = collisions;
        const res = resolutions;
        setCollisionDialogOpen(false);
        setPendingBringSubjects(null);
        setCollisions([]);
        setResolutions({});
        await proceedWithBring(oldSubjects, res, detected);
    };

    const proceedWithBring = async (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oldSubjects: any[],
        res: Record<string, CollisionResolution>,
        detectedCollisions: SubjectCollision[],
    ) => {
        if (!user || !activeHousehold?.id || !pendingExitHouseholdId) return;
        setSubmitting(true);

        try {
            const subjectIdMap = new Map<string, string>();
            const collisionLookup = new Map(detectedCollisions.map(c => [c.oldSubjectId, c]));
            for (const old of oldSubjects) {
                const r = res[old.id];
                const collision = collisionLookup.get(old.id);
                if (collision && r?.kind === "merge") {
                    subjectIdMap.set(old.id, collision.existingId);
                    continue;
                }
                const insertName = r?.kind === "new" && r.newName.trim()
                    ? r.newName.trim()
                    : collision
                        ? `${old.name} (2)`
                        : old.name;
                const { data: inserted } = await supabase
                    .from("subjects")
                    .insert({
                        household_id: activeHousehold.id,
                        type: old.type as any,
                        name: insertName,
                        user_id: old.user_id === user.id ? user.id : null,
                        sort_order: old.sort_order ?? 0,
                    })
                    .select("id")
                    .single();
                if (inserted) subjectIdMap.set(old.id, inserted.id);
            }

            // Seed monthly_* rows for the current financial month so Overview
            // shows the brought sources immediately (Income/Expenses pages would
            // otherwise have to be visited first to trigger their carry-forward).
            const financialMonthStart = (activeHousehold as any).financial_month_start || 25;
            const month = getCurrentFinancialMonth(financialMonthStart);
            const { start, end } = getFinancialMonthRange(month, financialMonthStart);
            const monthStartStr = format(start, "yyyy-MM-dd");
            const monthEndStr = format(end, "yyyy-MM-dd");

            for (const section of SECTIONS) {
                const picked = items.filter(i => i.section === section.key && selectedIds.has(i.id));
                for (const item of picked) {
                    const newRow: Record<string, any> = { ...item.raw };
                    delete newRow.id;
                    delete newRow.created_at;
                    delete newRow.updated_at;
                    newRow.household_id = activeHousehold.id;
                    if (section.authorCol === "owner_id") newRow.owner_id = user.id;
                    else newRow.created_by = user.id;

                    let amountPlain: string | null = null;
                    for (const col of section.encryptedCols) {
                        const cipher = item.raw[col];
                        if (!cipher) {
                            if (col === section.amountCol) {
                                throw new Error(`Couldn't bring "${item.label}" — amount missing on the source row.`);
                            }
                            newRow[col] = null;
                            continue;
                        }
                        const plain = await decryptFromPendingExit(cipher);
                        if (plain == null) {
                            if (col === section.amountCol) {
                                throw new Error(`Couldn't bring "${item.label}" — failed to decrypt its amount.`);
                            }
                            newRow[col] = null;
                            continue;
                        }
                        if (col === section.amountCol) amountPlain = plain;
                        newRow[col] = await encrypt(plain);
                    }
                    if (amountPlain == null) {
                        throw new Error(`Couldn't bring "${item.label}" — amount column not captured.`);
                    }

                    if (section.subjectCol) {
                        const oldSubjId = item.raw[section.subjectCol];
                        newRow[section.subjectCol] = oldSubjId ? subjectIdMap.get(oldSubjId) ?? null : null;
                    }
                    if (section.coParentCol) {
                        newRow[section.coParentCol] = null;
                    }
                    if ("member_id" in newRow) {
                        // The *_one_attribution check constraint allows member_id
                        // OR subject_id, never both. Default to the current user's
                        // new membership only when the row isn't subject-attributed.
                        const hasSubject = !!(section.subjectCol && newRow[section.subjectCol]);
                        newRow.member_id = hasSubject
                            ? null
                            : activeMembers.find(m => m.user_id === user.id)?.id ?? null;
                    }

                    const { data: insertedSource, error: insertError } = await (supabase as any)
                        .from(section.key)
                        .insert(newRow)
                        .select("id")
                        .single();
                    if (insertError || !insertedSource) {
                        throw new Error(`Failed to bring ${section.title}: ${insertError?.message ?? "no row returned"}`);
                    }

                    if (section.key === "income_sources" || section.key === "expenses") {
                        const encryptedBudget = await encrypt(amountPlain);
                        const fkCol = section.key === "income_sources" ? "income_source_id" : "expense_id";
                        const monthlyTable = section.key === "income_sources" ? "monthly_incomes" : "monthly_expenses";
                        const { error: monthlyError } = await (supabase as any).from(monthlyTable).insert({
                            [fkCol]: insertedSource.id,
                            household_id: activeHousehold.id,
                            month,
                            month_start: monthStartStr,
                            month_end: monthEndStr,
                            encrypted_budget_snapshot: encryptedBudget,
                            created_by: user.id,
                        });
                        if (monthlyError) {
                            throw new Error(`Brought "${item.label}" but failed to seed this month's row: ${monthlyError.message}`);
                        }
                    }

                    if (item.kind === "attributed") {
                        const { error: archiveError } = await (supabase as any)
                            .from(section.key)
                            .update({ archived_at: new Date().toISOString(), archived_by: user.id })
                            .eq("id", item.id);
                        if (archiveError) {
                            throw new Error(`Brought "${item.label}" into your new household but failed to archive it in the old one: ${archiveError.message}`);
                        }
                    }
                }
            }

            const { error: exitError } = await (supabase as any).rpc("confirm_member_exit");
            if (exitError) throw new Error(exitError.message || "Could not finalize exit");

            clearPendingExitDEK();
            await refreshHousehold();

            toast({
                title: "All done",
                description: selectedIds.size === 0
                    ? "You're set up in your household."
                    : `Brought ${selectedIds.size} item${selectedIds.size === 1 ? "" : "s"} along.`,
            });
        } catch (err: any) {
            console.error("Exit dialog failed:", err);
            toast({
                title: "Couldn't finish",
                description: err?.message ?? "Try again.",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={() => { /* not dismissable */ }}>
            <DialogContent
                className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
                hideClose
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>
                        {activeRole === "member"
                            ? `Welcome to ${activeHousehold?.name ?? "your new household"}`
                            : "Pick what to bring along"}
                    </DialogTitle>
                    <DialogDescription>
                        Items tagged as yours come along by default. Tick anything else you want to bring.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-10 flex justify-center">
                        <Loader2 className="animate-spin h-6 w-6 text-muted" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted py-6 text-center">
                        Nothing personal to bring along. You're all set in {activeHousehold?.name ?? "your new household"}.
                    </p>
                ) : (
                    <div className="space-y-5 py-2">
                        {SECTIONS.map(section => {
                            const sectionItems = itemsBySection.get(section.key) ?? [];
                            if (sectionItems.length === 0) return null;
                            const SectionIcon = section.sectionIcon;
                            const orderedItems = [
                                ...sectionItems.filter(i => i.kind === "attributed"),
                                ...sectionItems.filter(i => i.kind === "added"),
                            ];
                            return (
                                <div key={section.key} className="space-y-2">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <SectionIcon className="h-4 w-4 text-muted" />
                                        {section.title}
                                    </h4>
                                    <Card variant="flush">
                                        {orderedItems.map((item, idx) => {
                                            const { icon, hue } = categoryFor(section.key, item.category);
                                            const checked = selectedIds.has(item.id);
                                            return (
                                                <RowItem
                                                    key={item.id}
                                                    last={idx === orderedItems.length - 1}
                                                    onClick={() => toggleItem(item.id)}
                                                >
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={() => toggleItem(item.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    {section.key === "subscriptions" ? (
                                                        <ServiceIcon
                                                            serviceName={item.label}
                                                            fallbackIcon={icon}
                                                            fallbackHue={hue}
                                                            size={32}
                                                        />
                                                    ) : (
                                                        <CatIcon icon={icon} hue={hue} size={32} />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-sm sm:text-base truncate">{item.label}</span>
                                                    </div>
                                                    {item.amount != null && (
                                                        <span className="flex items-baseline gap-1 shrink-0">
                                                            <Money v={item.amount} currency="SEK" size="base" weight={500} />
                                                            {billingSuffix(item.billingCycle) && (
                                                                <span className="text-xs text-muted">{billingSuffix(item.billingCycle)}</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </RowItem>
                                            );
                                        })}
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter className="sm:justify-between">
                    {items.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (selectedIds.size === items.length) {
                                    setSelectedIds(new Set());
                                } else {
                                    setSelectedIds(new Set(items.map(i => i.id)));
                                }
                            }}
                            className="text-xs text-accent hover:underline self-center"
                        >
                            {selectedIds.size === items.length ? "Clear all" : "Select all"}
                        </button>
                    ) : <span />}
                    <Button onClick={handleConfirm} disabled={submitting || loading || collisionDialogOpen}>
                        {submitting ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bringing…</>
                        ) : items.length === 0 ? (
                            <>Finish <ArrowRight className="h-4 w-4 ml-2" /></>
                        ) : (
                            <>Bring {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} along <ArrowRight className="h-4 w-4 ml-2" /></>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={collisionDialogOpen} onOpenChange={() => { /* not dismissable */ }}>
            <DialogContent
                className="sm:max-w-md"
                hideClose
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Resolve duplicate labels</DialogTitle>
                    <DialogDescription>
                        Some of the labels you're bringing along already exist here. Tell us which is which.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    {collisions.map(c => {
                        const r = resolutions[c.oldSubjectId] ?? { kind: "merge", newName: `${c.oldName} (2)` };
                        const TypeIcon = SUBJECT_TYPE_ICON[c.type] ?? Box;
                        return (
                            <div key={c.oldSubjectId} className="space-y-2 rounded-lg border border-line p-3">
                                <div className="flex items-center gap-2">
                                    <TypeIcon className="h-4 w-4 text-muted" />
                                    <span className="font-medium">{c.oldName}</span>
                                    <span className="text-xs text-muted">already exists</span>
                                </div>
                                <RadioGroup
                                    value={r.kind}
                                    onValueChange={(v) => setResolutions(prev => ({
                                        ...prev,
                                        [c.oldSubjectId]: {
                                            kind: v as CollisionResolutionKind,
                                            newName: prev[c.oldSubjectId]?.newName ?? `${c.oldName} (2)`,
                                        },
                                    }))}
                                    className="space-y-1.5"
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="merge" id={`r-merge-${c.oldSubjectId}`} />
                                        <Label htmlFor={`r-merge-${c.oldSubjectId}`} className="text-sm font-normal cursor-pointer">
                                            Same as the existing "{c.existingName}"
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="new" id={`r-new-${c.oldSubjectId}`} />
                                        <Label htmlFor={`r-new-${c.oldSubjectId}`} className="text-sm font-normal cursor-pointer">
                                            Different — keep mine separately
                                        </Label>
                                    </div>
                                </RadioGroup>
                                {r.kind === "new" && (
                                    <Input
                                        value={r.newName}
                                        onChange={(e) => setResolutions(prev => ({
                                            ...prev,
                                            [c.oldSubjectId]: { kind: "new", newName: e.target.value },
                                        }))}
                                        placeholder={`${c.oldName} (2)`}
                                        className="text-sm"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                <DialogFooter>
                    <Button onClick={handleResolveCollisions} disabled={submitting}>
                        Continue <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
};
