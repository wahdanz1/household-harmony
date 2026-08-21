/**
 * Co-parents for the active household, with their account-link state.
 *
 * A co-parent is a plain label until it is linked to a real account through a
 * co-parenting space. Once linked, the two of you share a space key and they
 * can see the kid schedule and the costs published to them — nothing else in
 * the household.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CoParentPendingInvite {
    id: string;
    email: string;
    expiresAt: string;
}

export interface CoParent {
    id: string;
    name: string;
    notes: string | null;
    linkedUserId: string | null;
    spaceId: string | null;
    /** Set once someone other than the inviter has joined the space. */
    isLinked: boolean;
    pendingInvite: CoParentPendingInvite | null;
}

export function useCoParents(householdId?: string, currentUserId?: string) {
    const [coParents, setCoParents] = useState<CoParent[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!householdId) {
            setCoParents([]);
            setLoading(false);
            return;
        }

        const { data: rows, error } = await supabase
            .from('co_parents')
            .select('id, name, notes, linked_user_id, space_id')
            .eq('household_id', householdId)
            .order('name');

        if (error || !rows) {
            setCoParents([]);
            setLoading(false);
            return;
        }

        const spaceIds = rows.map(r => r.space_id).filter((id): id is string => !!id);

        // One round-trip each for invites and membership rather than per co-parent.
        const [invitesRes, membersRes] = await Promise.all([
            spaceIds.length
                ? supabase
                      .from('coparent_space_invites')
                      .select('id, space_id, invited_email, expires_at')
                      .in('space_id', spaceIds)
                      .eq('is_active', true)
                      .gt('expires_at', new Date().toISOString())
                : Promise.resolve({ data: [] as never[] }),
            spaceIds.length
                ? supabase
                      .from('coparent_space_members')
                      .select('space_id, user_id')
                      .in('space_id', spaceIds)
                : Promise.resolve({ data: [] as never[] }),
        ]);

        const invitesBySpace = new Map<string, CoParentPendingInvite>();
        for (const inv of invitesRes.data ?? []) {
            invitesBySpace.set(inv.space_id, {
                id: inv.id,
                email: inv.invited_email,
                expiresAt: inv.expires_at,
            });
        }

        // Linked means somebody besides you is actually in the space — an
        // outstanding invite is not a link.
        const othersBySpace = new Map<string, string>();
        for (const m of membersRes.data ?? []) {
            if (m.user_id !== currentUserId) othersBySpace.set(m.space_id, m.user_id);
        }

        setCoParents(
            rows.map(r => ({
                id: r.id,
                name: r.name,
                notes: r.notes,
                linkedUserId: r.linked_user_id,
                spaceId: r.space_id,
                isLinked: !!r.space_id && othersBySpace.has(r.space_id),
                pendingInvite: r.space_id ? invitesBySpace.get(r.space_id) ?? null : null,
            })),
        );
        setLoading(false);
    }, [householdId, currentUserId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { coParents, loading, refresh };
}
