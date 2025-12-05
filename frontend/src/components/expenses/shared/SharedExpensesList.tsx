import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Plus, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataListItem } from "@/components/ui/data-list-item";

interface SharedExpense {
    id: string;
    description: string;
    amount: number;
    notes: string | null;
    co_parent_id: string;
    created_at: string;
    paid_by: "user" | "co_parent";
}

interface CoParent {
    id: string;
    name: string;
}

interface SharedExpensesListProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
    coParents: CoParent[];
    expenses: SharedExpense[];
    totalSharedExpenses: number;
    expensesByCoParent: Record<string, SharedExpense[]>;
    onUpdate: () => void;
}

export const SharedExpensesList = ({
    householdId,
    currency,
    monthStart,
    monthEnd,
    coParents,
    expenses,
    totalSharedExpenses,
    expensesByCoParent,
    onUpdate
}: SharedExpensesListProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({
        description: "",
        amount: "",
        co_parent_id: "",
        notes: "",
        paid_by: "user" as "user" | "co_parent",
    });
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<{ id: string, name: string } | null>(null);

    const [editingExpense, setEditingExpense] = useState<SharedExpense | null>(null);

    const resetForm = () => {
        setFormData({
            description: "",
            amount: "",
            co_parent_id: coParents[0]?.id || "",
            notes: "",
            paid_by: "user",
        });
        setEditingExpense(null);
    };

    const handleEdit = (expense: SharedExpense) => {
        setEditingExpense(expense);
        setFormData({
            description: expense.description,
            amount: expense.amount.toString(),
            co_parent_id: expense.co_parent_id,
            notes: expense.notes || "",
            paid_by: expense.paid_by,
        });
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!user) return;

        const data = {
            household_id: householdId,
            co_parent_id: formData.co_parent_id,
            month: format(monthStart, "yyyy-MM-dd"),
            month_start: format(monthStart, "yyyy-MM-dd"),
            month_end: format(monthEnd, "yyyy-MM-dd"),
            description: formData.description,
            amount: parseFloat(formData.amount),
            notes: formData.notes,
            paid_by: formData.paid_by,
            created_by: user.id,
        };

        let error;
        if (editingExpense) {
            ({ error } = await supabase
                .from("shared_expenses")
                .update(data)
                .eq("id", editingExpense.id));
        } else {
            ({ error } = await supabase
                .from("shared_expenses")
                .insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: `Failed to ${editingExpense ? "update" : "add"} shared expense`,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: `Shared expense ${editingExpense ? "updated" : "added"}`,
            });
            setIsOpen(false);
            resetForm();
            onUpdate();
        }
    };

    const confirmDelete = () => {
        if (editingExpense) {
            setExpenseToDelete({ id: editingExpense.id, name: editingExpense.description });
            setDeleteConfirmOpen(true);
        }
    };

    const handleConfirmedDelete = async () => {
        if (!expenseToDelete) return;

        const { error } = await supabase.from("shared_expenses").delete().eq("id", expenseToDelete.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete expense",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Shared expense deleted",
            });
            onUpdate();
            setIsOpen(false); // Close the edit dialog as well
        }

        setDeleteConfirmOpen(false);
        setExpenseToDelete(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Shared Expenses
                    </CardTitle>
                    <CardDescription className="mt-1.5">Items purchased that are shared with co-parents</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button className="w-full">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Shared Expense
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingExpense ? "Edit" : "Add"} Shared Expense</DialogTitle>
                                <DialogDescription>
                                    {editingExpense ? "Update the details of this expense" : "Add an expense shared with a co-parent"}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Co-Parent</Label>
                                    <Select value={formData.co_parent_id} onValueChange={(v) => setFormData({ ...formData, co_parent_id: v })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select co-parent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {coParents.map((cp) => (
                                                <SelectItem key={cp.id} value={cp.id}>
                                                    {cp.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="e.g., Rain clothing for school"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount</Label>
                                    <Input
                                        type="number"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Paid by</Label>
                                    <Select value={formData.paid_by} onValueChange={(v: "user" | "co_parent") => setFormData({ ...formData, paid_by: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">You</SelectItem>
                                            <SelectItem value="co_parent">Co-parent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Notes (Optional)</Label>
                                    <Textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Additional details"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
                                <Button onClick={handleSave} className="w-full">
                                    {editingExpense ? "Update Expense" : "Add Expense"}
                                </Button>
                                <div className="flex gap-2 w-full">
                                    <Button variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>Cancel</Button>
                                    {editingExpense && (
                                        <Button variant="destructive" type="button" className="flex-1" onClick={confirmDelete}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {coParents.map((coParent) => {
                        const coParentExpenses = expensesByCoParent[coParent.id] || [];
                        if (coParentExpenses.length === 0) return null;

                        const total = coParentExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0);

                        return (
                            <div key={coParent.id} className="space-y-2">
                                <h3 className="font-semibold text-sm text-muted-foreground">
                                    {coParent.name} - {total.toFixed(0)} {currency}
                                </h3>
                                {coParentExpenses.map((expense) => (
                                    <DataListItem
                                        key={expense.id}
                                        onClick={() => handleEdit(expense)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{expense.description}</p>
                                                    <Badge variant={expense.paid_by === "user" ? "destructive" : "default"}>
                                                        {expense.paid_by === "user" ? "You paid" : "They paid"}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {expense.amount} {currency}
                                                    {expense.notes && ` • ${expense.notes}`}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(expense.created_at), "MMM d, yyyy")}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(expense);
                                            }}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </DataListItem>
                                ))}
                            </div>
                        );
                    })}

                    {expenses.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                            No shared expenses this month. Add one above!
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{expenseToDelete?.name}". This action cannot be undone.
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
