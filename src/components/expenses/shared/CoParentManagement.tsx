import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoParent {
    id: string;
    name: string;
    notes: string | null;
}

interface CoParentManagementProps {
    householdId: string;
    coParents: CoParent[];
    onUpdate: () => void;
}

export const CoParentManagement = ({ householdId, coParents, onUpdate }: CoParentManagementProps) => {
    const { toast } = useToast();
    const [coParentDialogOpen, setCoParentDialogOpen] = useState(false);
    const [editingCoParentId, setEditingCoParentId] = useState<string | null>(null);
    const [coParentFormData, setCoParentFormData] = useState({
        name: "",
        notes: "",
    });
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [coParentToDelete, setCoParentToDelete] = useState<{ id: string, name: string } | null>(null);

    const resetCoParentForm = () => {
        setCoParentFormData({ name: "", notes: "" });
        setEditingCoParentId(null);
    };

    const handleEditCoParent = (coParent: CoParent) => {
        setCoParentFormData({
            name: coParent.name,
            notes: coParent.notes || "",
        });
        setEditingCoParentId(coParent.id);
        setCoParentDialogOpen(true);
    };

    const handleSaveCoParent = async () => {
        const data = {
            household_id: householdId,
            name: coParentFormData.name,
            notes: coParentFormData.notes || null,
        };

        let error;
        if (editingCoParentId) {
            ({ error } = await supabase.from("co_parents").update(data).eq("id", editingCoParentId));
        } else {
            ({ error } = await supabase.from("co_parents").insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save co-parent",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: editingCoParentId ? "Co-parent updated" : "Co-parent added",
            });
            setCoParentDialogOpen(false);
            resetCoParentForm();
            onUpdate();
        }
    };

    const confirmDelete = (id: string, name: string) => {
        setCoParentToDelete({ id, name });
        setDeleteConfirmOpen(true);
    };

    const handleConfirmedDelete = async () => {
        if (!coParentToDelete) return;

        const { error } = await supabase.from("co_parents").delete().eq("id", coParentToDelete.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete co-parent",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Co-parent deleted",
            });
            onUpdate();
        }

        setDeleteConfirmOpen(false);
        setCoParentToDelete(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Manage Co-Parents
                            </CardTitle>
                            <CardDescription className="mt-1.5">Add and manage people you share expenses with</CardDescription>
                        </div>
                        <Dialog open={coParentDialogOpen} onOpenChange={(open) => {
                            setCoParentDialogOpen(open);
                            if (!open) resetCoParentForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Co-Parent
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingCoParentId ? "Edit" : "Add"} Co-Parent</DialogTitle>
                                    <DialogDescription>
                                        Add someone you share expenses with (ex-partner, co-guardian, etc.)
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input
                                            value={coParentFormData.name}
                                            onChange={(e) => setCoParentFormData({ ...coParentFormData, name: e.target.value })}
                                            placeholder="e.g., Kids' Mom"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notes (Optional)</Label>
                                        <Textarea
                                            value={coParentFormData.notes}
                                            onChange={(e) => setCoParentFormData({ ...coParentFormData, notes: e.target.value })}
                                            placeholder="Any additional context"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSaveCoParent}>
                                        {editingCoParentId ? "Update" : "Add"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {coParents.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No co-parents yet. Add one to get started!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {coParents.map((coParent) => (
                                <div
                                    key={coParent.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                                >
                                    <div>
                                        <p className="font-medium">{coParent.name}</p>
                                        {coParent.notes && (
                                            <p className="text-sm text-muted-foreground">{coParent.notes}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditCoParent(coParent)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => confirmDelete(coParent.id, coParent.name)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{coParentToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
