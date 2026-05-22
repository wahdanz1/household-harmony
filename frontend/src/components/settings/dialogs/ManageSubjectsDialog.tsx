import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

export type SubjectType = "kid" | "car" | "pet" | "other";

export interface Subject {
    id: string;
    name: string;
    type: SubjectType;
    sort_order?: number;
}

interface ManageSubjectsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The subject type this dialog is managing. */
    type: SubjectType;
    /** Display label (e.g. "Cars"). */
    label: string;
    householdId: string;
    /** Re-fetch parent on any change. */
    onChange: () => void;
}

export const ManageSubjectsDialog = ({ open, onOpenChange, type, label, householdId, onChange }: ManageSubjectsDialogProps) => {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState("");
    const [adding, setAdding] = useState(false);
    const [working, setWorking] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

    const fetchSubjects = async () => {
        const { data } = await supabase
            .from("subjects")
            .select("*")
            .eq("household_id", householdId)
            .eq("type", type)
            .order("sort_order")
            .order("name");
        const fetched = (data as Subject[]) ?? [];
        setSubjects(fetched);

        if (fetched.length === 0) {
            setCounts({});
            return;
        }

        // Count live (non-archived) items attached to each subject. Spans the
        // three tables that have subject_id: expenses, subscriptions,
        // insurances. income_sources has no subject_id, so it doesn't count.
        const subjectIds = fetched.map(s => s.id);
        const [expRows, subRows, insRows] = await Promise.all([
            supabase.from("expenses").select("subject_id").eq("household_id", householdId).in("subject_id", subjectIds).is("archived_at", null),
            supabase.from("subscriptions").select("subject_id").eq("household_id", householdId).in("subject_id", subjectIds).is("archived_at", null),
            supabase.from("insurances").select("subject_id").eq("household_id", householdId).in("subject_id", subjectIds).is("archived_at", null),
        ]);
        const next: Record<string, number> = {};
        for (const sid of subjectIds) next[sid] = 0;
        for (const row of [...(expRows.data ?? []), ...(subRows.data ?? []), ...(insRows.data ?? [])]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sid = (row as any).subject_id as string | null;
            if (sid && sid in next) next[sid] += 1;
        }
        setCounts(next);
    };

    useEffect(() => {
        if (open) {
            fetchSubjects();
            setEditingId(null);
            setDraftName("");
            setAdding(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, householdId, type]);

    const handleAdd = async () => {
        if (!draftName.trim()) return;
        setWorking(true);
        const { error } = await supabase.from("subjects").insert({
            household_id: householdId,
            name: draftName.trim(),
            type,
        });
        setWorking(false);
        if (error) {
            toast.error("Failed to add");
            return;
        }
        setDraftName("");
        setAdding(false);
        await fetchSubjects();
        onChange();
    };

    const handleSaveEdit = async (id: string) => {
        if (!draftName.trim()) return;
        setWorking(true);
        const { error } = await supabase.from("subjects").update({ name: draftName.trim() }).eq("id", id);
        setWorking(false);
        if (error) {
            toast.error("Failed to update");
            return;
        }
        setEditingId(null);
        setDraftName("");
        await fetchSubjects();
        onChange();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setWorking(true);
        const { error } = await supabase.from("subjects").delete().eq("id", deleteTarget.id);
        setWorking(false);
        if (error) {
            toast.error("Failed to delete");
            return;
        }
        setDeleteTarget(null);
        await fetchSubjects();
        onChange();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage {label.toLowerCase()}</DialogTitle>
                    <DialogDescription>
                        Add, rename, or remove the {label.toLowerCase()} you want to track costs for.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    {subjects.length === 0 && !adding && (
                        <p className="text-sm text-muted py-2">No {label.toLowerCase()} yet.</p>
                    )}
                    {subjects.map(s => (
                        <div key={s.id} className="flex items-center gap-2 py-1">
                            {editingId === s.id ? (
                                <>
                                    <Input
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(s.id)}
                                        autoFocus
                                        className="flex-1"
                                    />
                                    <Button size="sm" onClick={() => handleSaveEdit(s.id)} disabled={working}>
                                        Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDraftName(""); }}>
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm text-ink">{s.name}</span>
                                    <span className="text-xs text-muted tabular-nums">
                                        {(counts[s.id] ?? 0)} connection{(counts[s.id] ?? 0) === 1 ? "" : "s"}
                                    </span>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => { setEditingId(s.id); setDraftName(s.name); }}
                                        aria-label="Edit"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setDeleteTarget(s)}
                                        aria-label="Delete"
                                        className="text-danger hover:text-danger"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    ))}

                    {adding && (
                        <div className="flex items-center gap-2 py-1">
                            <Input
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                                placeholder={`e.g. ${type === "car" ? "Volvo XC40" : type === "kid" ? "Liam" : type === "pet" ? "Whiskers" : "Name"}`}
                                autoFocus
                                className="flex-1"
                            />
                            <Button size="sm" onClick={handleAdd} disabled={working || !draftName.trim()}>
                                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraftName(""); }}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>

                {!adding && (
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => { setAdding(true); setDraftName(""); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add {label.slice(0, -1).toLowerCase()}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title={`Delete ${deleteTarget?.name ?? "this"}?`}
                description="Existing costs that reference it will lose the tag. This can't be undone."
                busy={working}
                onConfirm={handleDelete}
            />
        </Dialog>
    );
};
