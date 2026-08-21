/**
 * Colours a co-parent can pick for their side of the schedule.
 *
 * Class strings are spelled out rather than composed, because Tailwind only
 * ships classes it can see in source — a template-built name would be purged.
 *
 * These are deliberately raw palette colours rather than app tokens: they are a
 * user's personal choice, not semantic UI state, and the point is that the two
 * sides are told apart at a glance.
 */

export type ScheduleColorId = 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'teal';

export interface ScheduleColor {
    id: ScheduleColorId;
    label: string;
    /** Calendar day cell. */
    cell: string;
    /** Small swatch for the picker and legend. */
    swatch: string;
}

export const SCHEDULE_COLORS: ScheduleColor[] = [
    {
        id: 'emerald',
        label: 'Green',
        cell: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/30',
        swatch: 'bg-emerald-500',
    },
    {
        id: 'violet',
        label: 'Purple',
        cell: 'bg-violet-500/20 border-violet-500/40 text-violet-800 dark:text-violet-200 hover:bg-violet-500/30',
        swatch: 'bg-violet-500',
    },
    {
        id: 'sky',
        label: 'Blue',
        cell: 'bg-sky-500/20 border-sky-500/40 text-sky-800 dark:text-sky-200 hover:bg-sky-500/30',
        swatch: 'bg-sky-500',
    },
    {
        id: 'amber',
        label: 'Amber',
        cell: 'bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30',
        swatch: 'bg-amber-500',
    },
    {
        id: 'rose',
        label: 'Rose',
        cell: 'bg-rose-500/20 border-rose-500/40 text-rose-800 dark:text-rose-200 hover:bg-rose-500/30',
        swatch: 'bg-rose-500',
    },
    {
        id: 'teal',
        label: 'Teal',
        cell: 'bg-teal-500/20 border-teal-500/40 text-teal-800 dark:text-teal-200 hover:bg-teal-500/30',
        swatch: 'bg-teal-500',
    },
];

const BY_ID = new Map(SCHEDULE_COLORS.map(c => [c.id, c]));

export function scheduleColor(id: string | null | undefined): ScheduleColor {
    return BY_ID.get((id ?? 'emerald') as ScheduleColorId) ?? SCHEDULE_COLORS[0];
}
