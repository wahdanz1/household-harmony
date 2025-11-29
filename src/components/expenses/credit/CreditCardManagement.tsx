import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface CreditCard {
    id: string;
    name: string;
    monthly_limit: number;
}

interface CreditCardManagementProps {
    householdId: string;
    currency: string;
    creditCards: CreditCard[];
    onUpdate: () => void;
}

export const CreditCardManagement = ({ householdId, currency, creditCards, onUpdate }: CreditCardManagementProps) => {
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
            monthly_limit: card.monthly_limit.toString(),
        });
        setEditingCardId(card.id);
        setCardDialogOpen(true);
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
                            <CardDescription className="mt-1.5">Add and manage your credit cards with monthly limits</CardDescription>
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
                                            onClick={() => confirmDeleteCard(card.id, card.name)}
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
