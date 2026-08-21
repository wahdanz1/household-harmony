/**
 * Which co-parenting spaces the signed-in user belongs to, and which side of
 * each they are.
 *
 * Resolved from space membership rather than from the household's `co_parents`
 * rows, because only the inviting household has those — the co-parent needs the
 * same page to work from the other direction.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ScheduleSide } from '@/utils/schedule';

export interface SpaceContext {
    id: string;
    name: string;
    /** 'owner' if this user created the space, otherwise 'coparent'. */
    mySide: ScheduleSide;
    defaultHandoverTime: string;
    /** Whether anyone else has actually joined yet. */
    hasCoParent: boolean;
    /** Colour this user picked for their own days. */
    myColor: string;
    /** Colour the other side picked. Both see the same mapping. */
    otherColor: string;
}

export function useCoParentSpaceContext(userId?: string) {
    const [spaces, setSpaces] = useState<SpaceContext[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!userId) {
            setSpaces([]);
            setLoading(false);
            return;
        }

        const { data: memberships, error } = await supabase
            .from('coparent_space_members')
            .select('space_id, role, color, coparent_spaces(id, name, default_handover_time)')
            .eq('user_id', userId);

        if (error || !memberships?.length) {
            setSpaces([]);
            setLoading(false);
            return;
        }

        const spaceIds = memberships.map(m => m.space_id);
        const { data: allMembers } = await supabase
            .from('coparent_space_members')
            .select('space_id, user_id, color, role')
            .in('space_id', spaceIds);

        const otherCount = new Map<string, number>();
        const otherColor = new Map<string, string>();
        for (const m of allMembers ?? []) {
            if (m.user_id !== userId) {
                otherCount.set(m.space_id, (otherCount.get(m.space_id) ?? 0) + 1);
                otherColor.set(m.space_id, m.color ?? 'violet');
            }
        }

        setSpaces(
            memberships
                .map(m => {
                    const space = m.coparent_spaces as unknown as {
                        id: string;
                        name: string;
                        default_handover_time: string;
                    } | null;
                    if (!space) return null;
                    return {
                        id: space.id,
                        name: space.name,
                        mySide: (m.role === 'owner' ? 'owner' : 'coparent') as ScheduleSide,
                        defaultHandoverTime: space.default_handover_time ?? '17:00',
                        hasCoParent: (otherCount.get(m.space_id) ?? 0) > 0,
                        myColor: m.color ?? 'emerald',
                        // Nobody has joined yet, but their days still need a
                        // colour so the calendar reads as two sides, not one.
                        otherColor: otherColor.get(m.space_id) ?? 'violet',
                    };
                })
                .filter((s): s is SpaceContext => s !== null),
        );
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setMyColor = useCallback(
        async (spaceId: string, color: string) => {
            if (!userId) return;
            await supabase
                .from('coparent_space_members')
                .update({ color })
                .eq('space_id', spaceId)
                .eq('user_id', userId);
            await refresh();
        },
        [userId, refresh],
    );

    return { spaces, loading, refresh, setMyColor };
}
