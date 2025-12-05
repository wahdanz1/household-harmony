import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DataListItem } from "@/components/ui/data-list-item";
import { creditCategories } from "@/constants/creditCategories";
import { getCategoryIcon, getCategoryBadgeStyle } from "@/utils/categoryHelpers";

interface CreditCardExpense {
    id: string;
    credit_card_id: string;
    category: string;
    description: string;
    amount: number;
    notes: string | null;
    credit_cards: {
        name: string;
    };
}

interface CreditCard {
    id: string;
    name: string;
}

interface CreditExpensesListProps {
    householdId: string;
    currency: string;
    monthStart: Date;
    monthEnd: Date;
    creditCards: CreditCard[];
    expenses: CreditCardExpense[];
    onUpdate: () => void;
}

export const CreditExpensesList = ({ householdId, currency, monthStart, monthEnd, creditCards, expenses, onUpdate }: CreditExpensesListProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        credit_card_id: "",
        category: "groceries",
        description: "",
        amount: "0",
        notes: "",
    });
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<{ id: string, name: string } | null>(null);

    const resetForm = () => {
        setFormData({
            credit_card_id: creditCards[0]?.id || "",
            category: "groceries",
            description: "",
            amount: "0",
            notes: "",
        });
        setEditingId(null);
    };

    const handleEdit = (expense: CreditCardExpense) => {
        setFormData({
            credit_card_id: expense.credit_card_id,
            category: expense.category,
            description: expense.description,
            amount: expense.amount.toString(),
            notes: expense.notes || "",
        });
        setEditingId(expense.id);
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!user) return;

        const data = {
            household_id: householdId,
            credit_card_id: formData.credit_card_id,
            month: format(monthStart, "yyyy-MM-dd"),
            month_start: format(monthStart, "yyyy-MM-dd"),
            month_end: format(monthEnd, "yyyy-MM-dd"),
            category: formData.category,
            description: formData.description,
            amount: parseFloat(formData.amount),
            notes: formData.notes || null,
            created_by: user.id,
        };

        let error;
        if (editingId) {
            ({ error } = await supabase
                .from("credit_card_expenses")
                .update(data)
                .eq("id", editingId));
        } else {
            ({ error } = await supabase
                .from("credit_card_expenses")
                .insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save credit card expense",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: editingId ? "Expense updated" : "Expense added",
            });
            setIsOpen(false);
            resetForm();
            onUpdate();
        }
    };

    const confirmDelete = (id: string, description: string) => {
        setExpenseToDelete({ id, name: description });
        setDeleteConfirmOpen(true);
    };

    const handleConfirmedDelete = async () => {
        if (!expenseToDelete) return;

        const { error } = await supabase.from("credit_card_expenses").delete().eq("id", expenseToDelete.id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete expense",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Expense deleted",
            });
            onUpdate();
        }

        setDeleteConfirmOpen(false);
        setExpenseToDelete(null);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Credit Card Expenses</CardTitle>
                            <CardDescription className="mt-1.5">Track expenses paid with credit cards</CardDescription>
                        </div>
                        <Dialog open={isOpen} onOpenChange={(open) => {
                            setIsOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingId ? "Edit" : "Add"} Credit Card Expense</DialogTitle>
                                    <DialogDescription>
                                        Track an expense paid with a credit card
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Credit Card</Label>
                                        <Select value={formData.credit_card_id} onValueChange={(v) => setFormData({ ...formData, credit_card_id: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {creditCards.map((card) => (
                                                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {creditCategories.map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        <div className="flex items-center gap-2">
                                                            <cat.icon className="h-4 w-4" />
                                                            {cat.label}
                                                        </div>
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
                                            placeholder="e.g., Weekly groceries"
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
                                        <Label>Notes (Optional)</Label>
                                        <Textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            placeholder="Additional details..."
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="flex-col gap-2">
                                    <Button onClick={handleSave} className="w-full">
                                        {editingId ? "Update" : "Add"}
                                    </Button>
                                    {editingId && (
                                        <div className="flex gap-2 w-full">
                                            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
                                                Cancel
                                            </Button>
                                            <Button variant="destructive" onClick={() => confirmDelete(editingId, formData.description)} className="flex-1">
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {expenses.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No expenses yet. Add one to get started!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {expenses.map((expense) => {
                                const badgeStyle = getCategoryBadgeStyle(expense.category, creditCategories);
                                const category = creditCategories.find(c => c.value === expense.category);
                                return (
                                    <DataListItem
                                        key={expense.id}
                                        onClick={() => handleEdit(expense)}
                                    >
                                        {/* Mobile: Two-line layout */}
                                        <div className="sm:hidden space-y-3">
                                            {/* Top row: Icon + Title */}
                                            <div className="flex items-center gap-2">
                                                {getCategoryIcon(expense.category, creditCategories, MoreHorizontal)}
                                                <p className="font-medium flex-1 truncate">{expense.description}</p>
                                            </div>
                                            {/* Bottom row: Card name, Amount and buttons */}
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm text-muted-foreground">{expense.credit_cards.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{expense.amount.toFixed(0)} {currency}</p>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(expense);
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop: Single line layout */}
                                        <div className="hidden sm:flex items-center gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(expense.category, creditCategories, MoreHorizontal)}
                                                    <p className="font-medium truncate">{expense.description}</p>
                                                    {category && (
                                                        <span
                                                            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                                                            style={badgeStyle}
                                                        >
                                                            {category.label}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">{expense.credit_cards.name}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium whitespace-nowrap">{expense.amount.toFixed(0)} {currency}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(expense);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </DataListItem>
                                );
                            })}
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
