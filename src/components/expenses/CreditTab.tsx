import { useState, useEffect } from "react";
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
import { CreditCard, Plus, Edit, Trash2, ShoppingCart, Fuel, ShoppingBag, UtensilsCrossed, Film, Wrench, Plane, Heart, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";

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
    monthly_limit: number;
}

interface CreditTabProps {
    householdId: string;
    currency: string;
}

const creditCategories = [
    { value: "groceries", label: "Groceries", color: "#10B981", icon: ShoppingCart },
    { value: "fuel", label: "Fuel", color: "#F59E0B", icon: Fuel },
    { value: "shopping", label: "Shopping", color: "#EC4899", icon: ShoppingBag },
    { value: "dining_out", label: "Dining Out", color: "#EF4444", icon: UtensilsCrossed },
    { value: "entertainment", label: "Entertainment", color: "#8B5CF6", icon: Film },
    { value: "car_repairs", label: "Car Repairs", color: "#F97316", icon: Wrench },
    { value: "travel", label: "Travel", color: "#06B6D4", icon: Plane },
    { value: "health", label: "Health & Wellness", color: "#14B8A6", icon: Heart },
    { value: "other", label: "Other", color: "#64748B", icon: MoreHorizontal },
];

const getCategoryIcon = (categoryValue: string) => {
    const category = creditCategories.find(c => c.value === categoryValue);
    const IconComponent = category?.icon || MoreHorizontal;
    return <IconComponent className="h-4 w-4" />;
};

export const CreditTab = ({ householdId, currency }: CreditTabProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [expenses, setExpenses] = useState<CreditCardExpense[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        credit_card_id: "",
        category: "groceries",
        description: "",
        amount: "0",
        notes: "",
    });
    const [cardDialogOpen, setCardDialogOpen] = useState(false);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [cardFormData, setCardFormData] = useState({
        name: "",
        monthly_limit: "0",
    });
    const [loading, setLoading] = useState(true);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'card' | 'expense', id: string, name: string } | null>(null);

    const currentMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");

    useEffect(() => {
        fetchData();
    }, [householdId]);

    const fetchData = async () => {
        const [
            { data: cardsData },
            { data: expensesData },
        ] = await Promise.all([
            supabase.from("credit_cards").select("*").eq("household_id", householdId).eq("is_active", true),
            supabase.from("credit_card_expenses").select("*, credit_cards(name)").eq("household_id", householdId).eq("month", currentMonth),
        ]);

        setCreditCards(cardsData || []);
        setExpenses(expensesData || []);
        setLoading(false);
    };

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

    const resetCardForm = () => {
        setCardFormData({ name: "", monthly_limit: "0" });
        setEditingCardId(null);
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

    const handleEditCard = (card: CreditCard) => {
        setCardFormData({
            name: card.name,
            monthly_limit: card.monthly_limit.toString(),
        });
        setEditingCardId(card.id);
        setCardDialogOpen(true);
    };

    const handleSave = async () => {
        if (!user) return;

        const data = {
            household_id: householdId,
            credit_card_id: formData.credit_card_id,
            month: currentMonth,
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
            fetchData();
        }
    };

    const handleSaveCard = async () => {
        if (!user) return;

        const data = {
            household_id: householdId,
            name: cardFormData.name,
            monthly_limit: parseFloat(cardFormData.monthly_limit),
            created_by: user.id,
        };

        let error;
        if (editingCardId) {
            ({ error } = await supabase
                .from("credit_cards")
                .update(data)
                .eq("id", editingCardId));
        } else {
            ({ error } = await supabase
                .from("credit_cards")
                .insert(data));
        }

        if (error) {
            toast({
                title: "Error",
                description: "Failed to save credit card",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: editingCardId ? "Credit card updated" : "Credit card added",
            });
            setCardDialogOpen(false);
            resetCardForm();
            fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase
            .from("credit_card_expenses")
            .delete()
            .eq("id", id);

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
            fetchData();
        }
    };

    const handleDeleteCard = async (id: string) => {
        const { error } = await supabase
            .from("credit_cards")
            .delete()
            .eq("id", id);

        if (error) {
            toast({
                title: "Error",
                description: "Failed to delete credit card",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Success",
                description: "Credit card deleted",
            });
            fetchData();
        }
    };

    const confirmDelete = (type: 'card' | 'expense', id: string, name: string) => {
        setItemToDelete({ type, id, name });
        setDeleteConfirmOpen(true);
    };

    const handleConfirmedDelete = async () => {
        if (!itemToDelete) return;
        const table = itemToDelete.type === 'card' ? 'credit_cards' : 'credit_card_expenses';
        const { error } = await supabase.from(table).delete().eq("id", itemToDelete.id);

        if (error) {
            toast({ title: "Error", description: `Failed to delete ${itemToDelete.type === 'card' ? 'credit card' : 'expense'}`, variant: "destructive" });
        } else {
            toast({ title: "Success", description: `${itemToDelete.type === 'card' ? 'Credit card' : 'Expense'} deleted` });
            fetchData();
        }
        setDeleteConfirmOpen(false);
        setItemToDelete(null);
    };

    const calculateCardTotal = (cardId: string) => {
        return expenses
            .filter(e => e.credit_card_id === cardId)
            .reduce((sum, e) => sum + e.amount, 0);
    };

    if (loading) {
        return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Credit Card Management */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Manage Credit Cards
                            </CardTitle>
                            <CardDescription>Add and manage your credit cards with monthly limits</CardDescription>
                        </div>
                        <Dialog open={cardDialogOpen} onOpenChange={(open) => {
                            setCardDialogOpen(open);
                            if (!open) resetCardForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Credit Card
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingCardId ? "Edit" : "Add"} Credit Card</DialogTitle>
                                    <DialogDescription>
                                        Configure a credit card with a monthly spending limit
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Card Name</Label>
                                        <Input
                                            value={cardFormData.name}
                                            onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })}
                                            placeholder="e.g., Norwegian Bank, Visa Gold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Monthly Limit</Label>
                                        <Input
                                            type="number"
                                            value={cardFormData.monthly_limit}
                                            onChange={(e) => setCardFormData({ ...cardFormData, monthly_limit: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSaveCard}>
                                        {editingCardId ? "Update" : "Add"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {creditCards.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No credit cards yet. Add one to get started!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {creditCards.map((card) => (
                                <div
                                    key={card.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            <p className="font-medium">{card.name}</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Monthly Limit: {card.monthly_limit.toFixed(0)} {currency}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditCard(card)}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => confirmDelete('card', card.id, card.name)}
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

            {creditCards.length === 0 ? null : (
                <>
                    {/* Summary Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {creditCards.map((card) => {
                            const total = calculateCardTotal(card.id);
                            const remaining = card.monthly_limit - total;
                            const percentage = (total / card.monthly_limit) * 100;

                            return (
                                <Card key={card.id}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            {card.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Spent</span>
                                                <span className="font-medium">{total.toFixed(0)} {currency}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Limit</span>
                                                <span>{card.monthly_limit.toFixed(0)} {currency}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Remaining</span>
                                                <span className={remaining < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                                                    {remaining.toFixed(0)} {currency}
                                                </span>
                                            </div>
                                            <div className="w-full bg-secondary rounded-full h-2 mt-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${percentage > 100 ? "bg-destructive" : percentage > 80 ? "bg-orange-500" : "bg-green-600"
                                                        }`}
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Expenses List */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Credit Card Expenses</CardTitle>
                                    <CardDescription>Track expenses paid with credit cards</CardDescription>
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
                                        <DialogFooter>
                                            <Button onClick={handleSave}>
                                                {editingId ? "Update" : "Add"}
                                            </Button>
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
                                    {expenses.map((expense) => (
                                        <div
                                            key={expense.id}
                                            className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(expense.category)}
                                                    <p className="font-medium">{expense.description}</p>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {creditCategories.find(c => c.value === expense.category)?.label} • {expense.credit_cards.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-medium">{expense.amount.toFixed(0)} {currency}</p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(expense)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => confirmDelete('expense', expense.id, expense.description)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{itemToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
