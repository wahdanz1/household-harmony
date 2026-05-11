import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Baby, Box, Car, PawPrint, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHouseholdSubjects, type SubjectType, type SubjectOption } from "@/hooks/useHouseholdSubjects";

const NONE_VALUE = "__none__";

const TYPE_OPTIONS: { value: Exclude<SubjectType, "member">; label: string; icon: any }[] = [
    { value: "kid", label: "Kid", icon: Baby },
    { value: "car", label: "Car", icon: Car },
    { value: "pet", label: "Pet", icon: PawPrint },
    { value: "other", label: "Other", icon: Box },
];

const ICON_FOR_TYPE: Record<SubjectType, any> = {
    member: User,
    kid: Baby,
    car: Car,
    pet: PawPrint,
    other: Box,
};

interface SubjectPickerProps {
    householdId: string;
    value: string | null | undefined;
    onChange: (subjectId: string | null) => void;
    label?: string;
}

export const SubjectPicker = ({
    householdId, value, onChange, label = "Belongs to",
}: SubjectPickerProps) => {
    const [refreshKey, setRefreshKey] = useState(0);
    const subjects = useHouseholdSubjects(householdId, refreshKey);
    const [addOpen, setAddOpen] = useState(false);

    useEffect(() => {
        if (!householdId) return;
        let cancelled = false;
        (async () => {
            const { data: members } = await supabase
                .from("household_members")
                .select("user_id, profiles(full_name, email)")
                .eq("household_id", householdId);
            if (cancelled || !members || members.length === 0) return;

            const { data: existing } = await supabase
                .from("subjects")
                .select("id, name, user_id")
                .eq("household_id", householdId)
                .eq("type", "member");

            const allMemberSubjects = (existing ?? []) as Array<{ id: string; name: string; user_id: string | null }>;
            const existingByUser = new Map<string, { id: string; name: string }>();
            const orphansByName = new Map<string, { id: string; name: string }>();
            for (const s of allMemberSubjects) {
                if (s.user_id) {
                    existingByUser.set(s.user_id, { id: s.id, name: s.name });
                } else {
                    orphansByName.set(s.name.trim().toLowerCase(), { id: s.id, name: s.name });
                }
            }

            const toInsert: Array<{ household_id: string; user_id: string; name: string; type: "member"; sort_order: number }> = [];
            const claims: Array<{ id: string; user_id: string; name: string }> = [];
            const renames: Array<{ id: string; name: string }> = [];

            for (const m of members as Array<{ user_id: string; profiles: any }>) {
                const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                const name = (p?.full_name || p?.email || "").trim();
                if (!name) continue;
                const current = existingByUser.get(m.user_id);
                if (current) {
                    if (current.name !== name) renames.push({ id: current.id, name });
                    continue;
                }
                // No row for this user yet — claim a name-matching orphan if one exists,
                // otherwise insert a fresh row.
                const orphan = orphansByName.get(name.toLowerCase());
                if (orphan) {
                    claims.push({ id: orphan.id, user_id: m.user_id, name });
                    orphansByName.delete(name.toLowerCase());
                } else {
                    toInsert.push({ household_id: householdId, user_id: m.user_id, name, type: "member", sort_order: 0 });
                }
            }

            let changed = false;
            if (toInsert.length > 0) {
                await supabase.from("subjects").insert(toInsert);
                changed = true;
            }
            for (const c of claims) {
                await supabase.from("subjects").update({ user_id: c.user_id, name: c.name }).eq("id", c.id);
                changed = true;
            }
            for (const r of renames) {
                await supabase.from("subjects").update({ name: r.name }).eq("id", r.id);
                changed = true;
            }
            if (changed && !cancelled) setRefreshKey((k) => k + 1);
        })();
        return () => { cancelled = true; };
    }, [householdId]);

    const members = subjects
        .filter((s) => s.type === "member")
        .sort((a, b) => a.name.localeCompare(b.name));
    const others = subjects
        .filter((s) => s.type !== "member")
        .sort((a, b) => a.name.localeCompare(b.name));

    const renderItem = (s: SubjectOption) => {
        const Icon = ICON_FOR_TYPE[s.type] ?? Box;
        return (
            <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{s.name}</span>
                </div>
            </SelectItem>
        );
    };

    return (
        <div className="space-y-1.5">
            <Label>{label} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <div className="flex gap-2">
                <Select
                    value={value ?? NONE_VALUE}
                    onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
                >
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Nobody / shared" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE_VALUE}>
                            <span className="text-muted-foreground">Nobody / shared</span>
                        </SelectItem>
                        {members.map(renderItem)}
                        {members.length > 0 && others.length > 0 && (
                            <SelectSeparator />
                        )}
                        {others.map(renderItem)}
                    </SelectContent>
                </Select>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddOpen(true)}
                    title="Add new subject"
                    className="h-10 w-10 p-0 shrink-0"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <AddSubjectDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                householdId={householdId}
                onCreated={(id) => {
                    onChange(id);
                    setRefreshKey((k) => k + 1);
                }}
            />
        </div>
    );
};

interface AddSubjectDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    householdId: string;
    onCreated: (id: string) => void;
}

const AddSubjectDialog = ({ open, onOpenChange, householdId, onCreated }: AddSubjectDialogProps) => {
    const [name, setName] = useState("");
    const [type, setType] = useState<Exclude<SubjectType, "member">>("car");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) { setName(""); setType("car"); }
    }, [open]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        const { data, error } = await supabase
            .from("subjects")
            .insert({ household_id: householdId, name: name.trim(), type })
            .select("id")
            .single();
        setSaving(false);
        if (error || !data) return;
        onCreated(data.id);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add subject</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as Exclude<SubjectType, "member">)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {TYPE_OPTIONS.map((opt) => {
                                    const Icon = opt.icon;
                                    return (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4" />
                                                <span>{opt.label}</span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Volvo, Whiskers"
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!name.trim() || saving}>Add</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
