/**
 * Publishing a household cost to a co-parenting space.
 *
 * Kept separate from the reading hook so a form can publish on save without
 * subscribing to every claim in the space.
 *
 * Everything meaningful is encrypted under the space key. `billing_cycle` stays
 * plaintext because it says how to read the amount, not what it is.
 */

import { supabase } from '@/integrations/supabase/client';

export type SharedCostSource = 'insurance' | 'income' | 'expense';

/** Encrypts under the space key. Supplied by the caller so keys stay in the context. */
export type EncryptForSpace = (plaintext: string) => Promise<string | null>;

export interface PublishClaimInput {
    spaceId: string;
    householdId: string;
    userId: string;
    sourceKind: SharedCostSource;
    sourceId: string | null;
    label: string;
    /** Which kid, by name — `subjects.id` is household-scoped and unreadable to them. */
    subject?: string | null;
    /** Full cost before the split. */
    amount: number;
    /** Percentage the publisher keeps; the co-parent owes the remainder. */
    sharePercentage: number;
    billingCycle?: string | null;
    encrypt: EncryptForSpace;
}

/**
 * Publish a cost, or restate what was already published from the same source.
 * Upserting on the source keeps editing an insurance from accumulating
 * duplicate claims.
 */
export async function publishCostClaim(input: PublishClaimInput): Promise<void> {
    const [label, subject, amount, share] = await Promise.all([
        input.encrypt(input.label),
        input.subject ? input.encrypt(input.subject) : Promise.resolve(null),
        input.encrypt(String(input.amount)),
        input.encrypt(String(input.sharePercentage)),
    ]);

    if (!label || !amount || !share) {
        throw new Error('Vault is locked; the cost was not shared.');
    }

    const { error } = await supabase
        .from('shared_cost_claims')
        .upsert(
            {
                space_id: input.spaceId,
                household_id: input.householdId,
                published_by: input.userId,
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

    if (error) throw new Error(`Could not share this cost: ${error.message}`);
}

/**
 * Stop sharing a cost. Deactivates rather than deletes, so months already
 * recorded keep their figures and past settlements stay correct.
 */
export async function withdrawCostClaim(params: {
    spaceId: string;
    sourceKind: SharedCostSource;
    sourceId: string | null;
}): Promise<void> {
    const { error } = await supabase
        .from('shared_cost_claims')
        .update({ is_active: false })
        .eq('space_id', params.spaceId)
        .eq('source_kind', params.sourceKind)
        .eq('source_id', params.sourceId);

    if (error) throw new Error(`Could not stop sharing this cost: ${error.message}`);
}

/**
 * Withdraw a cost from every space except the one it now belongs to.
 * Covers re-pointing an item at a different co-parent, which would otherwise
 * leave the previous one still seeing it.
 */
export async function withdrawFromOtherSpaces(params: {
    keepSpaceId: string | null;
    userId: string;
    sourceKind: SharedCostSource;
    sourceId: string;
}): Promise<void> {
    let query = supabase
        .from('shared_cost_claims')
        .update({ is_active: false })
        .eq('published_by', params.userId)
        .eq('source_kind', params.sourceKind)
        .eq('source_id', params.sourceId);

    if (params.keepSpaceId) query = query.neq('space_id', params.keepSpaceId);

    await query;
}
