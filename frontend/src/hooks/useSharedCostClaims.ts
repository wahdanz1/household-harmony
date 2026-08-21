/**
 * Costs published to, and received from, a co-parent.
 *
 * A claim is a statement rather than a mirror of a household row: "this cost
 * exists, this is the split". Nothing has to be kept in sync, because the
 * household's own insurance is not what crosses the boundary.
 *
 * Two levels. The claim is the standing arrangement and always reads current;
 * a claim month records what was actually paid then, so a later price change
 * cannot retroactively restate a month that has already been settled.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEncryption, spaceScope } from '@/contexts/EncryptionContext';

export type SharedCostSource = 'insurance' | 'income' | 'expense';

export interface SharedCostClaim {
    id: string;
    spaceId: string;
    householdId: string;
    publishedBy: string;
    sourceKind: SharedCostSource;
    sourceId: string | null;
    label: string | null;
    subject: string | null;
    /** Full amount of the cost, before the split. */
    amount: number | null;
    /** Percentage the publisher keeps; the co-parent owes the remainder. */
    sharePercentage: number | null;
    billingCycle: string | null;
    isActive: boolean;
    /** True when this household published it, false when it arrived from the other side. */
    isMine: boolean;
}

export interface SharedCostClaimMonth {
    claimId: string;
    month: string;
    amount: number | null;
}

interface ClaimRow {
    id: string;
    space_id: string;
    household_id: string;
    published_by: string;
    source_kind: SharedCostSource;
    source_id: string | null;
    encrypted_label: string | null;
    encrypted_subject: string | null;
    encrypted_amount: string | null;
    encrypted_share_percentage: string | null;
    billing_cycle: string | null;
    is_active: boolean;
}

const num = (v: string | null): number | null => {
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

export function useSharedCostClaims(spaceId?: string, userId?: string) {
    const { encryptFor, decryptFor, hasScopeKey } = useEncryption();
    const [claims, setClaims] = useState<SharedCostClaim[]>([]);
    const [months, setMonths] = useState<SharedCostClaimMonth[]>([]);
    const [loading, setLoading] = useState(true);

    const scope = spaceId ? spaceScope(spaceId) : null;
    const keyReady = !!scope && hasScopeKey(scope);

    const refresh = useCallback(async () => {
        if (!spaceId || !scope) {
            setClaims([]);
            setMonths([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('shared_cost_claims')
            .select('id, space_id, household_id, published_by, source_kind, source_id, encrypted_label, encrypted_subject, encrypted_amount, encrypted_share_percentage, billing_cycle, is_active')
            .eq('space_id', spaceId)
            .eq('is_active', true);

        if (error || !data) {
            setClaims([]);
            setLoading(false);
            return;
        }

        const rows = data as ClaimRow[];
        setClaims(
            await Promise.all(
                rows.map(async row => ({
                    id: row.id,
                    spaceId: row.space_id,
                    householdId: row.household_id,
                    publishedBy: row.published_by,
                    sourceKind: row.source_kind,
                    sourceId: row.source_id,
                    label: row.encrypted_label ? await decryptFor(scope, row.encrypted_label) : null,
                    subject: row.encrypted_subject ? await decryptFor(scope, row.encrypted_subject) : null,
                    amount: num(row.encrypted_amount ? await decryptFor(scope, row.encrypted_amount) : null),
                    sharePercentage: num(
                        row.encrypted_share_percentage
                            ? await decryptFor(scope, row.encrypted_share_percentage)
                            : null,
                    ),
                    billingCycle: row.billing_cycle,
                    isActive: row.is_active,
                    isMine: row.published_by === userId,
                })),
            ),
        );

        const { data: monthData } = await supabase
            .from('shared_cost_claim_months')
            .select('claim_id, month, encrypted_amount')
            .eq('space_id', spaceId);

        setMonths(
            await Promise.all(
                (monthData ?? []).map(async row => ({
                    claimId: row.claim_id,
                    month: row.month,
                    amount: num(row.encrypted_amount ? await decryptFor(scope, row.encrypted_amount) : null),
                })),
            ),
        );

        setLoading(false);
    }, [spaceId, scope, decryptFor, userId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    /**
     * Publish a cost, or update what was already published for the same source.
     * Idempotent per source so editing an insurance and publishing again does
     * not accumulate duplicates.
     */
    const publishClaim = useCallback(
        async (input: {
            householdId: string;
            sourceKind: SharedCostSource;
            sourceId: string | null;
            label: string;
            subject?: string | null;
            amount: number;
            sharePercentage: number;
            billingCycle?: string | null;
        }) => {
            if (!spaceId || !scope || !userId) return { error: 'No shared space available.' };

            const [label, subject, amount, share] = await Promise.all([
                encryptFor(scope, input.label),
                input.subject ? encryptFor(scope, input.subject) : Promise.resolve(null),
                encryptFor(scope, String(input.amount)),
                encryptFor(scope, String(input.sharePercentage)),
            ]);

            if (!label || !amount || !share) return { error: 'Could not encrypt the cost.' };

            const { error } = await supabase
                .from('shared_cost_claims')
                .upsert(
                    {
                        space_id: spaceId,
                        household_id: input.householdId,
                        published_by: userId,
                        source_kind: input.sourceKind,
                        source_id: input.sourceId,
                        encrypted_label: label,
                        encrypted_subject: subject,
                        encrypted_amount: amount,
                        encrypted_share_percentage: share,
                        billing_cycle: input.billingCycle ?? null,
                        is_active: true,
                    },
                    { onConflict: 'space_id,source_kind,source_id' },
                );

            if (error) return { error: 'Could not publish the cost.' };
            await refresh();
            return {};
        },
        [spaceId, scope, userId, encryptFor, refresh],
    );

    /** Stop sharing a cost. The months already recorded stay, so past settlements keep their figures. */
    const withdrawClaim = useCallback(
        async (sourceKind: SharedCostSource, sourceId: string | null) => {
            if (!spaceId) return { error: 'No shared space available.' };
            const { error } = await supabase
                .from('shared_cost_claims')
                .update({ is_active: false })
                .eq('space_id', spaceId)
                .eq('source_kind', sourceKind)
                .eq('source_id', sourceId);
            if (error) return { error: 'Could not stop sharing this cost.' };
            await refresh();
            return {};
        },
        [spaceId, refresh],
    );

    /** Record what a shared cost actually came to in one month. */
    const recordClaimMonth = useCallback(
        async (claimId: string, month: string, amount: number) => {
            if (!spaceId || !scope) return { error: 'No shared space available.' };
            const encrypted = await encryptFor(scope, String(amount));
            if (!encrypted) return { error: 'Could not encrypt the amount.' };

            const { error } = await supabase
                .from('shared_cost_claim_months')
                .upsert(
                    { claim_id: claimId, space_id: spaceId, month, encrypted_amount: encrypted },
                    { onConflict: 'claim_id,month' },
                );

            if (error) return { error: 'Could not record the amount.' };
            await refresh();
            return {};
        },
        [spaceId, scope, encryptFor, refresh],
    );

    /** Claims the other household published — what shows up in your own lists. */
    const incoming = useMemo(() => claims.filter(c => !c.isMine), [claims]);
    const outgoing = useMemo(() => claims.filter(c => c.isMine), [claims]);

    /**
     * What each side owes for a month. A month with a recorded amount uses it;
     * otherwise the standing arrangement stands in.
     */
    const balanceForMonth = useCallback(
        (month: string) => {
            let theyOweMe = 0;
            let iOweThem = 0;
            for (const c of claims) {
                const recorded = months.find(m => m.claimId === c.id && m.month === month);
                const total = recorded?.amount ?? c.amount;
                if (total === null || c.sharePercentage === null) continue;
                const otherShare = (total * (100 - c.sharePercentage)) / 100;
                if (c.isMine) theyOweMe += otherShare;
                else iOweThem += otherShare;
            }
            return { theyOweMe, iOweThem, net: theyOweMe - iOweThem };
        },
        [claims, months],
    );

    return {
        claims,
        incoming,
        outgoing,
        months,
        loading,
        keyReady,
        refresh,
        publishClaim,
        withdrawClaim,
        recordClaimMonth,
        balanceForMonth,
    };
}
