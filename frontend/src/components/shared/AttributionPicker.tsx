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
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

/**
 * What an attribution row references. Exactly one of (member, subject) is set,
 * or null for "nobody / shared". The DB enforces this via a CHECK constraint on
 * each table (expenses_one_attribution, etc.) so member_id / subject_id are
 * never both populated.
 */
export type AttributionValue =
    | { kind: "member"; id: string }
    | { kind: "subject"; id: string }
    | null;

const NONE_VALUE = "__none__";
const MEMBER_PREFIX = "m:";
const SUBJECT_PREFIX = "s:";

const TYPE_OPTIONS: { value: SubjectType; label: string; icon: any }[] = [
    { value: "kid", label: "Kid", icon: Baby },
    { value: "car", label: "Car", icon: Car },
    { value: "pet", label: "Pet", icon: PawPrint },
    { value: "other", label: "Other", icon: Box },
];

const ICON_FOR_TYPE: Record<SubjectType, any> = {
    kid: Baby,
    car: Car,
    pet: PawPrint,
    other: Box,
};

interface AttributionPickerProps {
    householdId: string;
    value: AttributionValue;
    onChange: (value: AttributionValue) => void;
    label?: string;
}

const encodeValue = (v: AttributionValue): string => {
    if (!v) return NONE_VALUE;
    return v.kind === "member" ? `${MEMBER_PREFIX}${v.id}` : `${SUBJECT_PREFIX}${v.id}`;
};

const decodeValue = (raw: string): AttributionValue => {
    if (raw === NONE_VALUE) return null;
    if (raw.startsWith(MEMBER_PREFIX)) return { kind: "member", id: raw.slice(MEMBER_PREFIX.length) };
    if (raw.startsWith(SUBJECT_PREFIX)) return { kind: "subject", id: raw.slice(SUBJECT_PREFIX.length) };
    return null;
};

export const AttributionPicker = ({
    householdId, value, onChange, label = "Belongs to",
}: AttributionPickerProps) => {
    const { user } = useAuth();
    const { members } = useHousehold();
    const [refreshKey, setRefreshKey] = useState(0);
    const subjects = useHouseholdSubjects(householdId, refreshKey);
    const [addOpen, setAddOpen] = useState(false);

    // Active members only — pending-exit ones are mid-leave and shouldn't be
    // assignable. Current user comes first; everyone else alphabetical.
    const activeMembers = members
        .filter(m => !(m as any).pending_exit_at)
        .slice()
        .sort((a, b) => {
            if (a.user_id === user?.id) return -1;
            if (b.user_id === user?.id) return 1;
            const an = a.profiles?.full_name ?? "";
            const bn = b.profiles?.full_name ?? "";
            return an.localeCompare(bn);
        });

    const sortedSubjects = subjects.slice().sort((a, b) => a.name.localeCompare(b.name));

    const memberLabel = (m: typeof members[number]) =>
        m.user_id === user?.id
            ? `${m.profiles?.full_name ?? "You"} (you)`
            : (m.profiles?.full_name ?? "Unknown");

    return (
        <div className="space-y-1.5">
            <Label>{label} <span className="text-xs text-muted font-normal">(optional)</span></Label>
            <div className="flex gap-2">
                <Select
                    value={encodeValue(value)}
                    onValueChange={(raw) => onChange(decodeValue(raw))}
                >
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Nobody / shared" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE_VALUE}>
                            <span className="text-muted">Nobody / shared</span>
                        </SelectItem>
                        {activeMembers.length > 0 && <SelectSeparator />}
                        {activeMembers.map((m) => (
                            <SelectItem key={m.id} value={`${MEMBER_PREFIX}${m.id}`}>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{memberLabel(m)}</span>
                                </div>
                            </SelectItem>
                        ))}
                        {sortedSubjects.length > 0 && <SelectSeparator />}
                        {sortedSubjects.map((s: SubjectOption) => {
                            const Icon = ICON_FOR_TYPE[s.type] ?? Box;
                            return (
                                <SelectItem key={s.id} value={`${SUBJECT_PREFIX}${s.id}`}>
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        <span>{s.name}</span>
                                    </div>
                                </SelectItem>
                            );
                        })}
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
                    onChange({ kind: "subject", id });
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
    const [type, setType] = useState<SubjectType>("car");
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
                        <Select value={type} onValueChange={(v) => setType(v as SubjectType)}>
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
