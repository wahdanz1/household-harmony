/**
 * Kid schedule for a co-parenting space.
 *
 * The table stores handovers — single transitions. Everything renderable is
 * derived here: consecutive handovers become blocks, and blocks become per-day
 * coverage. Because the source is transitions, a gap or an overlap cannot be
 * represented, so none of this needs to defend against one.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEncryption, spaceScope } from '@/contexts/EncryptionContext';
import { toBlocks, sideAt, type Handover, type ScheduleSide } from '@/utils/schedule';

export type { Handover, ScheduleSide, ScheduleBlock, DayCoverage } from '@/utils/schedule';
export { toBlocks, toDayCoverage, sideAt, dayKey } from '@/utils/schedule';

export interface ScheduleChange {
    id: string;
    action: 'created' | 'moved' | 'deleted';
    actorUserId: string;
    summary: string | null;
    createdAt: Date;
}

interface ChangeRow {
    id: string;
    action: 'created' | 'moved' | 'deleted';
    actor_user_id: string;
    encrypted_summary: string | null;
    created_at: string;
}

interface HandoverRow {
    id: string;
    at: string;
    to_side: ScheduleSide;
    encrypted_note: string | null;
    is_encrypted: boolean;
    created_by: string;
}

export function useSchedule(spaceId?: string) {
    const { decryptFor, encryptFor, hasScopeKey } = useEncryption();
    const [handovers, setHandovers] = useState<Handover[]>([]);
    const [changes, setChanges] = useState<ScheduleChange[]>([]);
    const [loading, setLoading] = useState(true);

    const scope = spaceId ? spaceScope(spaceId) : null;
    const keyReady = !!scope && hasScopeKey(scope);

    const refresh = useCallback(async () => {
        if (!spaceId || !scope) {
            setHandovers([]);
            setChanges([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('schedule_handovers')
            .select('id, at, to_side, encrypted_note, is_encrypted, created_by')
            .eq('space_id', spaceId)
            .order('at');

        if (error || !data) {
            setHandovers([]);
            setLoading(false);
            return;
        }

        const rows = data as HandoverRow[];
        const decrypted = await Promise.all(
            rows.map(async row => ({
                id: row.id,
                at: new Date(row.at),
                toSide: row.to_side,
                note: row.encrypted_note && row.is_encrypted
                    ? await decryptFor(scope, row.encrypted_note)
                    : null,
                createdBy: row.created_by,
            })),
        );

        setHandovers(decrypted);

        const { data: changeData } = await supabase
            .from('schedule_changes')
            .select('id, action, actor_user_id, encrypted_summary, created_at')
            .eq('space_id', spaceId)
            .order('created_at', { ascending: false })
            .limit(20);

        const changeRows = (changeData ?? []) as ChangeRow[];
        setChanges(
            await Promise.all(
                changeRows.map(async row => ({
                    id: row.id,
                    action: row.action,
                    actorUserId: row.actor_user_id,
                    summary: row.encrypted_summary
                        ? await decryptFor(scope, row.encrypted_summary)
                        : null,
                    createdAt: new Date(row.created_at),
                })),
            ),
        );

        setLoading(false);
    }, [spaceId, scope, decryptFor]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const logChange = useCallback(
        async (action: 'created' | 'moved' | 'deleted', summary: string, userId: string) => {
            if (!spaceId || !scope) return;
            const encrypted = await encryptFor(scope, summary);
            await supabase.from('schedule_changes').insert({
                space_id: spaceId,
                actor_user_id: userId,
                action,
                encrypted_summary: encrypted,
            });
        },
        [spaceId, scope, encryptFor],
    );

    const addHandover = useCallback(
        async (at: Date, toSide: ScheduleSide, userId: string, note?: string) => {
            if (!spaceId || !scope) return { error: 'No space selected.' };

            const encryptedNote = note ? await encryptFor(scope, note) : null;
            const { error } = await supabase.from('schedule_handovers').insert({
                space_id: spaceId,
                at: at.toISOString(),
                to_side: toSide,
                encrypted_note: encryptedNote,
                created_by: userId,
            });

            if (error) {
                // The unique constraint is the guard against an ambiguous timeline.
                return {
                    error: error.code === '23505'
                        ? 'There is already a handover at that exact time.'
                        : 'Could not add the handover.',
                };
            }

            await logChange('created', `Handover to ${toSide} on ${at.toLocaleString()}`, userId);
            await refresh();
            return {};
        },
        [spaceId, scope, encryptFor, logChange, refresh],
    );

    /**
     * Insert many handovers at once, for extending a repeating pattern.
     * Instants already taken are skipped rather than failing the whole batch —
     * the point is to fill in around whatever is already agreed.
     */
    const addHandovers = useCallback(
        async (items: { at: Date; toSide: ScheduleSide }[], userId: string) => {
            if (!spaceId || !scope) return { error: 'No space selected.', added: 0 };

            const taken = new Set(handovers.map(h => h.at.getTime()));
            const fresh = items.filter(i => !taken.has(i.at.getTime()));
            if (!fresh.length) return { added: 0, skipped: items.length };

            const { error } = await supabase.from('schedule_handovers').insert(
                fresh.map(i => ({
                    space_id: spaceId,
                    at: i.at.toISOString(),
                    to_side: i.toSide,
                    created_by: userId,
                })),
            );

            if (error) return { error: 'Could not add the handovers.', added: 0 };

            await logChange(
                'created',
                `Repeated the pattern: ${fresh.length} handovers through ${fresh[fresh.length - 1].at.toLocaleDateString()}`,
                userId,
            );
            await refresh();
            return { added: fresh.length, skipped: items.length - fresh.length };
        },
        [spaceId, scope, handovers, logChange, refresh],
    );

    const moveHandover = useCallback(
        async (id: string, at: Date, userId: string, toSide?: ScheduleSide) => {
            if (!spaceId) return { error: 'No space selected.' };

            const { error } = await supabase
                .from('schedule_handovers')
                .update(toSide ? { at: at.toISOString(), to_side: toSide } : { at: at.toISOString() })
                .eq('id', id);

            if (error) {
                return {
                    error: error.code === '23505'
                        ? 'There is already a handover at that exact time.'
                        : 'Could not move the handover.',
                };
            }

            await logChange('moved', `Handover moved to ${at.toLocaleString()}`, userId);
            await refresh();
            return {};
        },
        [spaceId, logChange, refresh],
    );

    const removeHandover = useCallback(
        async (id: string, userId: string) => {
            const target = handovers.find(h => h.id === id);
            const { error } = await supabase.from('schedule_handovers').delete().eq('id', id);
            if (error) return { error: 'Could not delete the handover.' };

            await logChange(
                'deleted',
                `Handover on ${target?.at.toLocaleString() ?? 'unknown date'} removed`,
                userId,
            );
            await refresh();
            return {};
        },
        [handovers, logChange, refresh],
    );

    const blocks = useMemo(() => toBlocks(handovers), [handovers]);

    /** Side holding the kids right now, or null before the schedule starts. */
    const currentSide = useMemo<ScheduleSide | null>(
        () => sideAt(handovers, new Date()),
        [handovers],
    );

    /** The next handover from now, for the "until" line. */
    const nextHandover = useMemo(
        () => handovers.find(h => h.at.getTime() > Date.now()) ?? null,
        [handovers],
    );

    return {
        handovers,
        changes,
        addHandovers,
        blocks,
        currentSide,
        nextHandover,
        loading,
        keyReady,
        refresh,
        addHandover,
        moveHandover,
        removeHandover,
    };
}
