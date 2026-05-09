import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, creditCardFields } from "@/hooks/useEncryptedFields";

interface CreditCard {
    id: string;
    name: string;
    monthly_limit: number;
}

interface CreditCardManagementProps {
    householdId: string;
    currency: string;
    creditCards: CreditCard[];
    calculateCardTotal?: (cardId: string) => number;
    onUpdate: () => void;
}

export const CreditCardManagement = ({ householdId, currency, creditCards, calculateCardTotal, onUpdate }: CreditCardManagementProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [cardDialogOpen, setCardDialogOpen] = useState(false);
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [cardFormData, setCardFormData] = useState({
        name: "",
        monthly_limit: "0",
    });
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<{ id: string, name: string } | null>(null);

    const resetCardForm = () => {
        setCardFormData({ name: "", monthly_limit: "0" });
        setEditingCardId(null);
    };

    const handleEditCard = (card: CreditCard) => {
        setCardFormData({
            name: card.name,
            monthly_limit: (card.monthly_limit || 0).toString(),
        });
        setEditingCardId(card.id);
        setCardDialogOpen(true);
    };

    const { encryptRecord } = useEncryptedFields(creditCardFields);

    const handleSaveCard = async () => {
        if (!user) return;

        const baseData = {
            household_id: householdId,
            name: cardFormData.name,
            monthly_limit: parseFloat(cardFormData.monthly_limit),
            created_by: user.id,
            is_encrypted: false,
        };

        const data = await encryptRecord(baseData);

        let error;
        if (editingCardId) {
            // For updates, we need to extract ID and use the rest
            const { id, ...updateData } = data as any;

            ({ error } = await supabase
                .from("credit_cards")
                .update(updateData)
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
            onUpdate();
        }
    };

    const confirmDeleteCard = (id: string, name: string) => {
        setCardToDelete({ id, name });
        setDeleteConfirmOpen(true);
    };

    const handleConfirmedDelete = async () => {
        if (!cardToDelete) return;

        const { error } = await supabase.from("credit_cards").delete().eq("id", cardToDelete.id);

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
            onUpdate();
        }

        setDeleteConfirmOpen(false);
        setCardToDelete(null);
    };

    return (
        <>
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
                        <div className="grid-auto-fill-2">
                            {creditCards.map((card) => {
                                const total = calculateCardTotal ? calculateCardTotal(card.id) : 0;
                                const limit = card.monthly_limit || 0;
                                const remaining = limit - total;
                                const percentage = limit > 0 ? (total / limit) * 100 : 0;

                                return (
                                    <div
                                        key={card.id}
                                        className="card-block"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4" />
                                                <span className="font-medium">{card.name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => handleEditCard(card)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => confirmDeleteCard(card.id, card.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-baseline text-sm">
                                                <span className="flex items-baseline gap-1">
                                                    <Money v={total} currency={currency} size="sm" weight={600} />
                                                    <span className="text-muted-foreground">/</span>
                                                    <Money v={limit} currency={currency} size="sm" weight={500} color="muted" />
                                                </span>
                                                <span className="flex items-baseline gap-1">
                                                    <Money
                                                        v={Math.abs(remaining)}
                                                        currency={currency}
                                                        size="sm"
                                                        weight={500}
                                                        color={remaining < 0 ? "danger" : "accent"}
                                                    />
                                                    <span className={remaining < 0 ? "text-destructive" : "text-accent"}>
                                                        {remaining >= 0 ? "left" : "over"}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="w-full bg-secondary rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${percentage > 100 ? "bg-destructive" : percentage > 80 ? "bg-alert" : "bg-success"}`}
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
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
                            This will permanently delete "{cardToDelete?.name}". This action cannot be undone.
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
