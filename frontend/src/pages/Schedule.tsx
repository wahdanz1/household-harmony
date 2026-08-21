import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Palette, Repeat, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VaultLockedAlert } from "@/components/shared/VaultLockedAlert";
import { AvatarTrigger } from "@/components/shared/AvatarTrigger";
import { UserMenu } from "@/components/shared/UserMenu";
import { EmptyStateCard } from "@/components/shared/EmptyStateCard";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption, spaceScope } from "@/contexts/EncryptionContext";
import { useToast } from "@/hooks/use-toast";
import { useCoParentSpaceContext } from "@/hooks/useCoParentSpaceContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { supabase } from "@/integrations/supabase/client";
import { createSpaceForCoParent } from "@/services/coparentSpaces";
import { useSchedule } from "@/hooks/useSchedule";
import { toDayCoverage, dayKey, repeatPattern, type ScheduleSide, type Handover } from "@/utils/schedule";
import { SCHEDULE_COLORS, scheduleColor } from "@/constants/scheduleColors";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_COPARENT_NAME = "Other parent";

const ScheduleHeader = ({ onColors }: { onColors?: () => void }) => (
    <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-semibold text-ink">Kid schedule</h1>
        </div>
        <div className="flex items-center gap-1">
            {onColors && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted" onClick={onColors} aria-label="Schedule colours">
                    <Palette className="h-4 w-4" />
                </Button>
            )}
            {/* Desktop carries the avatar in the sidebar, so this is phone-only. */}
            <div className="md:hidden">
                <UserMenu trigger={<AvatarTrigger />} />
            </div>
        </div>
    </div>
);

const Schedule = () => {
    const { user } = useAuth();
    const { isUnlocked, loadScopeKey, wrapKeyForSelf } = useEncryption();
    const { household } = useHousehold();
    const { toast } = useToast();
    const { spaces, loading: spacesLoading, refresh: refreshSpaces, setMyColor } = useCoParentSpaceContext(user?.id);
    const [colorsOpen, setColorsOpen] = useState(false);

    const [spaceIndex, setSpaceIndex] = useState(0);
    const space = spaces[spaceIndex];

    const [month, setMonth] = useState(() => startOfMonth(new Date()));
    const [adding, setAdding] = useState<Date | null>(null);
    const [addTime, setAddTime] = useState("17:00");
    const [addSide, setAddSide] = useState<ScheduleSide>("owner");
    const [busy, setBusy] = useState(false);

    const {
        handovers, changes, nextHandover,
        addHandover, addHandovers, moveHandover, removeHandover,
    } = useSchedule(space?.id);

    const [editing, setEditing] = useState<Handover | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editTime, setEditTime] = useState("17:00");
    const [editSide, setEditSide] = useState<ScheduleSide>("owner");

    const [repeatOpen, setRepeatOpen] = useState(false);
    const [repeatFrom, setRepeatFrom] = useState("");
    const [repeatEvery, setRepeatEvery] = useState("1");
    const [repeatCount, setRepeatCount] = useState("12");
    const [repeatTime, setRepeatTime] = useState("17:00");
    const [repeatSide, setRepeatSide] = useState<ScheduleSide>("owner");

    const gridStart = useMemo(() => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), [month]);
    const gridEnd = useMemo(() => endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), [month]);

    const coverage = useMemo(
        () => toDayCoverage(handovers, gridStart, gridEnd),
        [handovers, gridStart, gridEnd],
    );

    const days = useMemo(() => {
        const out: Date[] = [];
        let d = gridStart;
        while (d <= gridEnd) {
            out.push(d);
            d = addDays(d, 1);
        }
        return out;
    }, [gridStart, gridEnd]);

    const createSchedule = async () => {
        if (!user || !household?.id) return;
        // Named generically on purpose: nothing should stand between wanting a
        // schedule and having one. The real name arrives when someone accepts
        // an invite, and can be edited in Settings meanwhile.
        const name = DEFAULT_COPARENT_NAME;

        setBusy(true);
        try {
            const { data: row, error } = await supabase
                .from("co_parents")
                .insert({ household_id: household.id, name })
                .select("id")
                .single();
            if (error || !row) throw new Error("Could not create the co-parent.");

            const { spaceId, dek } = await createSpaceForCoParent({
                coParentId: row.id,
                name,
                userId: user.id,
                wrapForSelf: wrapKeyForSelf,
            });
            loadScopeKey(spaceScope(spaceId), dek);
            await refreshSpaces();
        } catch (err) {
            toast({
                title: "Could not create schedule",
                description: err instanceof Error ? err.message : "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    if (!isUnlocked) {
        return (
            <div className="space-y-5">
                <ScheduleHeader />
                <VaultLockedAlert />
            </div>
        );
    }

    if (!spacesLoading && !space) {
        return (
            <div className="space-y-5">
                <ScheduleHeader />
                <EmptyStateCard
                    icon={CalendarDays}
                    iconClassName="text-accent"
                    headline="No schedule yet"
                    description="Create one to start planning who has the kids. Sharing it with your co-parent is optional and can wait."
                    primaryLabel={busy ? "Creating…" : "Create a schedule"}
                    onPrimary={createSchedule}
                    hideWizardLink
                />
            </div>
        );
    }

    const label = (side: ScheduleSide) =>
        side === space?.mySide ? "You" : space?.mySide === "owner" ? (space?.name ?? "Co-parent") : "Co-parent";

    const openAdd = (day: Date) => {
        setAddTime(space?.defaultHandoverTime?.slice(0, 5) ?? "17:00");
        // Default to handing over to whoever does not have them that evening,
        // which is the change someone opening this dialog almost always means.
        const cov = coverage.get(dayKey(day));
        setAddSide(cov?.side === "owner" ? "coparent" : "owner");
        setAdding(day);
    };

    const submitAdd = async () => {
        if (!adding || !user) return;
        const [h, m] = addTime.split(":").map(Number);
        const at = new Date(adding);
        at.setHours(h ?? 17, m ?? 0, 0, 0);

        setBusy(true);
        const { error } = await addHandover(at, addSide, user.id);
        setBusy(false);
        if (error) {
            toast({ title: "Could not add handover", description: error, variant: "destructive" });
            return;
        }
        setAdding(null);
    };

    const openEdit = (h: Handover) => {
        setEditing(h);
        setEditDate(format(h.at, "yyyy-MM-dd"));
        setEditTime(format(h.at, "HH:mm"));
        setEditSide(h.toSide);
    };

    const submitEdit = async () => {
        if (!editing || !user) return;
        const [hh, mm] = editTime.split(":").map(Number);
        const [y, mo, d] = editDate.split("-").map(Number);
        const at = new Date(y, (mo ?? 1) - 1, d ?? 1, hh ?? 17, mm ?? 0, 0, 0);

        setBusy(true);
        const { error } = await moveHandover(editing.id, at, user.id, editSide);
        setBusy(false);
        if (error) {
            toast({ title: "Could not move handover", description: error, variant: "destructive" });
            return;
        }
        setEditing(null);
    };

    const openRepeat = () => {
        // Continue from where the schedule leaves off, flipping sides, so the
        // common case is just picking how far ahead to go.
        const last = handovers[handovers.length - 1];
        const start = last ? new Date(last.at) : new Date();
        if (last) start.setDate(start.getDate() + 7);
        setRepeatFrom(format(start, "yyyy-MM-dd"));
        setRepeatTime(last ? format(last.at, "HH:mm") : (space?.defaultHandoverTime?.slice(0, 5) ?? "17:00"));
        setRepeatEvery("1");
        setRepeatCount("12");
        setRepeatSide(last ? (last.toSide === "owner" ? "coparent" : "owner") : "owner");
        setRepeatOpen(true);
    };

    const submitRepeat = async () => {
        if (!user) return;
        const [y, mo, d] = repeatFrom.split("-").map(Number);
        const [hh, mm] = repeatTime.split(":").map(Number);
        const items = repeatPattern({
            from: new Date(y, (mo ?? 1) - 1, d ?? 1),
            everyWeeks: Number(repeatEvery) || 1,
            count: Number(repeatCount) || 0,
            startSide: repeatSide,
            time: { hours: hh ?? 17, minutes: mm ?? 0 },
        });
        if (!items.length) return;

        setBusy(true);
        const { error, added, skipped } = await addHandovers(items, user.id);
        setBusy(false);
        if (error) {
            toast({ title: "Could not repeat the pattern", description: error, variant: "destructive" });
            return;
        }
        toast({
            title: `Added ${added} handovers`,
            description: skipped ? `${skipped} skipped — a handover already existed at that time.` : undefined,
        });
        setRepeatOpen(false);
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        const { error } = await removeHandover(id, user.id);
        if (error) toast({ title: "Error", description: error, variant: "destructive" });
    };

    const upcoming = handovers.filter(h => h.at.getTime() > Date.now()).slice(0, 8);

    return (
        <div className="space-y-5">
            <ScheduleHeader onColors={() => setColorsOpen(true)} />

            {nextHandover && (
                <p className="text-sm text-muted -mt-1">
                    Next handover{" "}
                    <span className="font-semibold text-ink">
                        {format(nextHandover.at, "EEE d MMM, HH:mm")}
                    </span>{" "}
                    to {label(nextHandover.toSide).toLowerCase()}
                </p>
            )}

            {spaces.length > 1 && (
                <div className="flex gap-2">
                    {spaces.map((s, i) => (
                        <Button
                            key={s.id}
                            size="sm"
                            variant={i === spaceIndex ? "default" : "outline"}
                            onClick={() => setSpaceIndex(i)}
                        >
                            {s.name}
                        </Button>
                    ))}
                </div>
            )}

            <SettingsCard
                eyebrow={format(month, "MMMM yyyy")}
                eyebrowRight={
                    <div className="flex gap-1 -my-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-accent-dk hover:text-accent-dk hover:bg-accent-tint" onClick={openRepeat}>
                            <Repeat className="h-3.5 w-3.5 mr-1.5" />
                            Repeat
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                }
            >
                <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map(d => (
                        <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted pb-1">
                            {d}
                        </div>
                    ))}
                    {days.map(day => {
                        const cov = coverage.get(dayKey(day));
                        const mine = cov?.side === space?.mySide;
                        const tone = cov
                            ? scheduleColor(mine ? space?.myColor : space?.otherColor).cell
                            : "border-line-2 text-muted hover:bg-surface-2";
                        return (
                            <button
                                key={day.toISOString()}
                                type="button"
                                onClick={() => openAdd(day)}
                                className={cn(
                                    "aspect-square rounded flex flex-col items-center justify-center gap-0.5 border transition-colors",
                                    !isSameMonth(day, month) && "opacity-40",
                                    tone,
                                    isToday(day) && "ring-1 ring-accent",
                                )}
                            >
                                <span className="text-sm font-semibold leading-none">{format(day, "d")}</span>
                                {cov?.handovers.map(h => (
                                    <span key={h.id} className="text-[10px] leading-none font-mono">
                                        {format(h.at, "HH:mm")}
                                    </span>
                                ))}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-sm", scheduleColor(space?.myColor).swatch)} />
                        You
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-sm", scheduleColor(space?.otherColor).swatch)} />
                        {label("owner") === "You" ? (space?.name ?? "Co-parent") : "Co-parent"}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm border border-line-2" />
                        No schedule
                    </span>
                    <span>Coloured by who has them overnight. Tap a day to add a handover.</span>
                </div>
            </SettingsCard>

            <SettingsCard eyebrow="Upcoming handovers" contentClassName={upcoming.length ? "p-0" : "p-5"}>
                {upcoming.length === 0 ? (
                    <p className="text-sm text-muted">Nothing scheduled ahead.</p>
                ) : (
                    <div className="divide-y divide-line-2">
                        {upcoming.map(h => (
                            <div key={h.id} className="px-5 py-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => openEdit(h)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <p className="font-semibold text-ink leading-tight">
                                        {format(h.at, "EEE d MMM, HH:mm")}
                                    </p>
                                    <p className="text-sm text-muted mt-0.5">
                                        To {label(h.toSide).toLowerCase()}
                                        {h.note ? ` · ${h.note}` : ""}
                                    </p>
                                </button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted hover:text-danger"
                                    onClick={() => handleDelete(h.id)}
                                    aria-label="Delete handover"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </SettingsCard>

            {changes.length > 0 && (
                <SettingsCard eyebrow="Recent changes" contentClassName="p-0">
                    <div className="divide-y divide-line-2">
                        {changes.slice(0, 6).map(c => (
                            <div key={c.id} className="px-5 py-2.5 flex items-start gap-2.5">
                                <History className="h-3.5 w-3.5 text-muted mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm text-ink leading-snug">
                                        {c.summary ?? c.action}
                                    </p>
                                    <p className="text-xs text-muted mt-0.5">
                                        {c.actorUserId === user?.id ? "You" : "Your co-parent"}
                                        {" · "}
                                        {format(c.createdAt, "d MMM, HH:mm")}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </SettingsCard>
            )}

            <Dialog open={repeatOpen} onOpenChange={(o) => { if (!busy) setRepeatOpen(o); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Repeat the pattern</DialogTitle>
                        <DialogDescription>
                            Fills the calendar forward, alternating sides. Existing handovers are left alone, so exceptions you have already agreed stay put.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="repeat-from">Starting</Label>
                                <Input id="repeat-from" type="date" value={repeatFrom} onChange={(e) => setRepeatFrom(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="repeat-time">At</Label>
                                <Input id="repeat-time" type="time" value={repeatTime} onChange={(e) => setRepeatTime(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="repeat-every">Every (weeks)</Label>
                                <Input id="repeat-every" type="number" min={1} max={8} value={repeatEvery} onChange={(e) => setRepeatEvery(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="repeat-count">How many</Label>
                                <Input id="repeat-count" type="number" min={1} max={104} value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>First one gives the kids to</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant={repeatSide === space?.mySide ? "default" : "outline"} onClick={() => space && setRepeatSide(space.mySide)} className="flex-1">You</Button>
                                <Button type="button" variant={repeatSide !== space?.mySide ? "default" : "outline"} onClick={() => space && setRepeatSide(space.mySide === "owner" ? "coparent" : "owner")} className="flex-1">{label("owner") === "You" ? (space?.name ?? "Co-parent") : "Co-parent"}</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRepeatOpen(false)} disabled={busy}>Cancel</Button>
                        <Button onClick={submitRepeat} disabled={busy}>Add handovers</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={(o) => { if (!o && !busy) setEditing(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move handover</DialogTitle>
                        <DialogDescription>
                            Both surrounding periods stretch or shrink to meet the new time.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Date</Label>
                                <Input id="edit-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-time">Time</Label>
                                <Input id="edit-time" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Kids go to</Label>
                            <div className="flex gap-2">
                                <Button type="button" variant={editSide === space?.mySide ? "default" : "outline"} onClick={() => space && setEditSide(space.mySide)} className="flex-1">You</Button>
                                <Button type="button" variant={editSide !== space?.mySide ? "default" : "outline"} onClick={() => space && setEditSide(space.mySide === "owner" ? "coparent" : "owner")} className="flex-1">{label("owner") === "You" ? (space?.name ?? "Co-parent") : "Co-parent"}</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
                        <Button onClick={submitEdit} disabled={busy}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={colorsOpen} onOpenChange={setColorsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Your colour</DialogTitle>
                        <DialogDescription>
                            Pick the colour for your own days. Your co-parent picks theirs, and you both see the same two colours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-3 gap-2">
                        {SCHEDULE_COLORS.map(c => {
                            const taken = c.id === space?.otherColor;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    disabled={taken}
                                    onClick={() => space && setMyColor(space.id, c.id)}
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                        c.id === space?.myColor
                                            ? "border-accent bg-accent-tint text-accent-dk"
                                            : "border-line-2 text-ink hover:bg-surface-2",
                                        taken && "opacity-40 cursor-not-allowed",
                                    )}
                                >
                                    <span className={cn("h-3.5 w-3.5 rounded-sm shrink-0", c.swatch)} />
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setColorsOpen(false)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!adding} onOpenChange={(o) => { if (!o && !busy) setAdding(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{adding ? `Handover on ${format(adding, "EEE d MMM")}` : ""}</DialogTitle>
                        <DialogDescription>
                            From this moment the kids are with whoever you pick. Everything after it follows until the next handover.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="handover-time">Time</Label>
                            <Input
                                id="handover-time"
                                type="time"
                                value={addTime}
                                onChange={(e) => setAddTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Kids go to</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={addSide === space?.mySide ? "default" : "outline"}
                                    onClick={() => space && setAddSide(space.mySide)}
                                    className="flex-1"
                                >
                                    You
                                </Button>
                                <Button
                                    type="button"
                                    variant={addSide !== space?.mySide ? "default" : "outline"}
                                    onClick={() => space && setAddSide(space.mySide === "owner" ? "coparent" : "owner")}
                                    className="flex-1"
                                >
                                    Co-parent
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setAdding(null)} disabled={busy}>Cancel</Button>
                        <Button onClick={submitAdd} disabled={busy}>
                            <Plus className="h-4 w-4 mr-1.5" />
                            Add handover
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Schedule;
