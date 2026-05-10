import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Baby, Box, Car, PawPrint, User } from "lucide-react";
import { useHouseholdSubjects, type SubjectType } from "@/hooks/useHouseholdSubjects";

const NONE_VALUE = "__none__";

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
    const subjects = useHouseholdSubjects(householdId);

    if (subjects.length === 0) return null;

    return (
        <div className="space-y-2">
            <Label>{label} <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Select
                value={value ?? NONE_VALUE}
                onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
            >
                <SelectTrigger><SelectValue placeholder="Nobody / shared" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                        <span className="text-muted-foreground">Nobody / shared</span>
                    </SelectItem>
                    {subjects.map((s) => {
                        const Icon = ICON_FOR_TYPE[s.type] ?? Box;
                        return (
                            <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    <span>{s.name}</span>
                                </div>
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
};
