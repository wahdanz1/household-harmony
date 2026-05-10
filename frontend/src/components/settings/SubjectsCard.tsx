import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tag, Plus, Edit, Trash2, User, Car, Baby, PawPrint, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SubjectType = "member" | "car" | "kid" | "pet" | "other";

interface Subject {
    id: string;
    name: string;
    type: SubjectType;
    sort_order: number;
}

interface SubjectsCardProps {
    householdId: string;
    onUpdate?: () => void;
    compact?: boolean;
}

const TYPE_OPTIONS: { value: SubjectType; label: string; icon: any }[] = [
    { value: "member", label: "Person", icon: User },
    { value: "kid", label: "Kid", icon: Baby },
    { value: "car", label: "Car", icon: Car },
    { value: "pet", label: "Pet", icon: PawPrint },
    { value: "other", label: "Other", icon: Box },
];

const iconForType = (type: SubjectType) =>
    TYPE_OPTIONS.find((o) => o.value === type)?.icon ?? Box;

export const SubjectsCard = ({ householdId, onUpdate, compact = false }: SubjectsCardProps) => {
    const { toast } = useToast();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{ name: string; type: SubjectType }>({
        name: "",
        type: "member",
    });

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
        fetchSubjects();
    }, [householdId]);

    const resetForm = () => {
        setFormData({ name: "", type: "member" });
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        const payload = {
            household_id: householdId,
            name: formData.name.trim(),
            type: formData.type,
        };
        const { error } = editingId
            ? await supabase.from("subjects").update(payload).eq("id", editingId)
            : await supabase.from("subjects").insert(payload);

        if (error) {
            toast({ title: "Error", description: "Failed to save subject", variant: "destructive" });
            return;
        }
        toast({ title: editingId ? "Subject updated" : "Subject added" });
        setIsOpen(false);
        resetForm();
        await fetchSubjects();
        onUpdate?.();
    };

    const handleEdit = (s: Subject) => {
        setFormData({ name: s.name, type: s.type });
        setEditingId(s.id);
        setIsOpen(true);
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from("subjects").delete().eq("id", id);
        if (error) {
            toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
            return;
        }
        toast({ title: "Subject deleted" });
        await fetchSubjects();
        onUpdate?.();
    };

    const content = (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit subject" : "Add subject"}</DialogTitle>
                        <DialogDescription>
                            Tag costs so you can ask "what does the Volvo cost per month?".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(v) => setFormData({ ...formData, type: v as SubjectType })}
                            >
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
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Volvo, Liam, Whiskers"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={!formData.name.trim()}>
                            {editingId ? "Save" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Button className="w-full" onClick={() => { resetForm(); setIsOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add subject
            </Button>

            {subjects.length > 0 ? (
                <div className="space-y-2">
                    {subjects.map((s) => {
                        const Icon = iconForType(s.type);
                        return (
                            <div key={s.id} className="list-row-compact">
                                <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{s.name}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-4 text-sm">
                    No subjects yet. Add a car, kid, or pet to tag costs to.
                </p>
            )}
        </>
    );

    if (compact) {
        return <div className="space-y-4">{content}</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Subjects
                </CardTitle>
                <CardDescription>
                    Things you want to track costs for — cars, kids, pets, or anything else.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {content}
            </CardContent>
        </Card>
    );
};
