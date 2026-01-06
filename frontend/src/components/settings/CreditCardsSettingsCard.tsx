import { useState, useEffect } from "react";
import { useEncryptedFields, creditCardFields } from "@/hooks/useEncryptedFields";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreditCard, Plus, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ... existing imports

export const CreditCardsSettingsCard = ({ householdId, enableCreditCards, currency, onUpdate }: CreditCardsSettingsCardProps) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // ... existing code

    const handleSave = async () => {
        if (!user) return;

        const baseData = {
            household_id: householdId,
            name: formData.name,
            monthly_limit: parseFloat(formData.monthly_limit),
            created_by: user.id,
            is_encrypted: false,
        };

        const data = await encryptRecord(baseData);
        // ... rest of handleSave

        let error;
        if (editingId) {
            const { id, ...updateData } = data as any;

            ({ error } = await supabase
                .from("credit_cards")
                .update(updateData)
                .eq("id", editingId));
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
                description: editingId ? "Credit card updated" : "Credit card added",
            });
            setIsOpen(false);
            resetForm();
            fetchCreditCards();
        }
    };

    const handleDelete = async (id: string) => {
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
            fetchCreditCards();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Credit Cards
                </CardTitle>
                <CardDescription className="mt-1.5">Manage credit cards with monthly spending limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="list-row">
                    <div className="space-y-0.5">
                        <Label>Enable Credit Card Tracking</Label>
                        <p className="text-sm text-muted-foreground">
                            Track credit card expenses with monthly limits
                        </p>
                    </div>
                    <Switch
                        checked={enableCreditCards}
                        onCheckedChange={handleToggleEnable}
                    />
                </div>

                {enableCreditCards && (
                    <>
                        <Dialog open={isOpen} onOpenChange={(open) => {
                            setIsOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button className="w-full">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Credit Card
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingId ? "Edit" : "Add"} Credit Card</DialogTitle>
                                    <DialogDescription>
                                        Configure a credit card with a monthly spending limit
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Card Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., Norwegian Bank, Visa Gold"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Monthly Limit</Label>
                                        <Input
                                            type="number"
                                            value={formData.monthly_limit}
                                            onChange={(e) => setFormData({ ...formData, monthly_limit: e.target.value })}
                                            placeholder="0"
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

                        <div className="space-y-2">
                            {creditCards.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    No credit cards yet. Add one to get started!
                                </p>
                            ) : (
                                creditCards.map((card) => (
                                    <div
                                        key={card.id}
                                        className="list-row-compact"
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
                                                onClick={() => handleEdit(card)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(card.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
