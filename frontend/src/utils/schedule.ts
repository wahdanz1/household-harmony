/**
 * Deriving a renderable schedule from handovers.
 *
 * The stored form is a list of transitions: at this instant, the kids go to
 * this side. Blocks and per-day coverage are derived, never stored, which is
 * what makes gaps and overlaps unrepresentable.
 */

export type ScheduleSide = 'owner' | 'coparent';

export interface Handover {
    id: string;
    at: Date;
    toSide: ScheduleSide;
    note: string | null;
    createdBy: string;
}

export interface ScheduleBlock {
    side: ScheduleSide;
    start: Date;
    /** Null on the final block — the arrangement runs until the next handover. */
    end: Date | null;
}

export interface DayCoverage {
    /** Side holding the kids for the largest part of the day. */
    side: ScheduleSide;
    /** Handovers falling on this day, in order. */
    handovers: Handover[];
}

/** Local-date key, not UTC — the calendar grid is drawn in local time. */
export function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Blocks from consecutive handovers. Expects `handovers` sorted by `at`. */
export function toBlocks(handovers: Handover[]): ScheduleBlock[] {
    return handovers.map((h, i) => ({
        side: h.toSide,
        start: h.at,
        end: i + 1 < handovers.length ? handovers[i + 1].at : null,
    }));
}

/**
 * Per-day coverage across [from, to] inclusive.
 *
 * A day belongs to whoever has the kids **overnight** — the side holding them
 * at the end of the day. Custody is reckoned in overnights, and "where do they
 * sleep" is the question the calendar is being asked. Weighting by hours
 * instead would hand a 13:20 school pickup back to the morning parent on a
 * technicality, which is not how anyone plans a week.
 *
 * Days before the first handover get no entry rather than a guess.
 */
export function toDayCoverage(
    handovers: Handover[],
    from: Date,
    to: Date,
): Map<string, DayCoverage> {
    const out = new Map<string, DayCoverage>();
    if (!handovers.length) return out;

    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());

    while (cursor <= last) {
        const dayStart = new Date(cursor);
        // Adding a day rather than setting 23:59 keeps DST transitions honest:
        // a 23- or 25-hour day still ends at the next local midnight.
        const dayEnd = new Date(cursor);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const side = sideAt(handovers, new Date(dayEnd.getTime() - 1));
        if (side) {
            out.set(dayKey(cursor), {
                side,
                handovers: handovers.filter(h => h.at >= dayStart && h.at < dayEnd),
            });
        }

        cursor.setDate(cursor.getDate() + 1);
    }

    return out;
}

/**
 * Generate a repeating handover pattern — the Friday-to-Friday rhythm that most
 * of a co-parenting schedule actually is, with exceptions edited in afterwards.
 *
 * Steps in whole local days and re-applies the wall-clock time each step, so a
 * 17:00 handover stays 17:00 across a DST change rather than drifting to 16:00
 * or 18:00 as fixed-millisecond arithmetic would.
 */
export function repeatPattern(params: {
    /** Day the first generated handover falls on. Its time comes from `time`. */
    from: Date;
    /** Weeks between handovers. 1 means every week. */
    everyWeeks: number;
    /** How many handovers to generate. */
    count: number;
    /** Side the first generated handover gives the kids to; alternates after. */
    startSide: ScheduleSide;
    time: { hours: number; minutes: number };
}): { at: Date; toSide: ScheduleSide }[] {
    const { from, everyWeeks, count, startSide, time } = params;
    if (everyWeeks < 1 || count < 1) return [];

    const out: { at: Date; toSide: ScheduleSide }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());

    for (let i = 0; i < count; i++) {
        const at = new Date(cursor);
        at.setHours(time.hours, time.minutes, 0, 0);
        out.push({
            at,
            toSide: i % 2 === 0
                ? startSide
                : startSide === 'owner' ? 'coparent' : 'owner',
        });
        cursor.setDate(cursor.getDate() + everyWeeks * 7);
    }

    return out;
}

/** Side holding the kids at `when`, or null if that is before the schedule starts. */
export function sideAt(handovers: Handover[], when: Date): ScheduleSide | null {
    let side: ScheduleSide | null = null;
    for (const h of handovers) {
        if (h.at <= when) side = h.toSide;
        else break;
    }
    return side;
}
