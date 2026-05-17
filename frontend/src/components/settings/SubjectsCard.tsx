import { useEffect, useState } from "react";
import { Car, Baby, PawPrint, Box } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";
import { ManageSubjectsDialog, SubjectType, Subject } from "./dialogs/ManageSubjectsDialog";

interface SubjectsCardProps {
    householdId: string;
    onUpdate?: () => void;
}

const TYPE_GROUPS: { type: SubjectType; label: string; icon: LucideIcon; singularEmpty: string }[] = [
    { type: "car", label: "Cars", icon: Car, singularEmpty: "Add a car to tag costs to" },
    { type: "kid", label: "Kids", icon: Baby, singularEmpty: "Add a kid to tag costs to" },
    { type: "pet", label: "Pets", icon: PawPrint, singularEmpty: "Add a pet to tag costs to" },
    { type: "other", label: "Other", icon: Box, singularEmpty: "Anything else you want to tag" },
];

export const SubjectsCard = ({ householdId, onUpdate }: SubjectsCardProps) => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [managingType, setManagingType] = useState<SubjectType | null>(null);

    const fetchSubjects = async () => {
        const { data } = await supabase
            .from("subjects")
            .select("*")
            .eq("household_id", householdId)
            .order("sort_order")
            .order("name");
        setSubjects((data as Subject[]) ?? []);
    };

    useEffect(() => {
        if (householdId) fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [householdId]);

    const handleChange = async () => {
        await fetchSubjects();
        onUpdate?.();
    };

    const activeType = managingType
        ? TYPE_GROUPS.find(g => g.type === managingType) ?? null
        : null;

    return (
        <>
            <SettingsCard eyebrow="Subjects" contentClassName="p-0">
                <SettingsList>
                    {TYPE_GROUPS.map(group => {
                        const items = subjects.filter(s => s.type === group.type);
                        const Icon = group.icon;
                        return (
                            <SettingsListItem
                                key={group.type}
                                icon={<Icon className="h-5 w-5" />}
                                title={group.label}
                                value={items.length > 0 ? items.map(s => s.name).join(", ") : group.singularEmpty}
                                onClick={() => setManagingType(group.type)}
                            />
                        );
                    })}
                </SettingsList>
            </SettingsCard>

            {activeType && (
                <ManageSubjectsDialog
                    open={managingType !== null}
                    onOpenChange={(open) => { if (!open) setManagingType(null); }}
                    type={activeType.type}
                    label={activeType.label}
                    householdId={householdId}
                    onChange={handleChange}
                />
            )}
        </>
    );
};
