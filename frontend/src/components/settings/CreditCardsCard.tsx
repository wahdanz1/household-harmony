import { useEffect, useState } from "react";
import { CreditCard as CreditCardIcon, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEncryptedFields, creditCardFields } from "@/hooks/useEncryptedFields";
import { SettingsCard, SettingsList, SettingsListItem } from "./SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtKr } from "@/components/ui/money";

interface Card {
    id: string;
    name: string;
    monthly_limit: number;
}

interface CreditCardsCardProps {
    householdId: string;
    currency: string;
    enabled: boolean;
}

export const CreditCardsCard = ({ householdId, currency, enabled }: CreditCardsCardProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const { encryptRecord, decryptRecords } = useEncryptedFields(creditCardFields);

    const [cards, setCards] = useState<Card[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", monthly_limit: "0" });
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    const fetchCards = async () => {
        const { data } = await supabase
            .from("credit_cards")
            .select("*")
            .eq("household_id", householdId)
            .eq("is_active", true);
        const decrypted = await decryptRecords(data || []);
        setCards(decrypted.map((c: any) => ({ ...c, monthly_limit: Number(c.monthly_limit || 0) })));
    };

    useEffect(() => {
        if (householdId && enabled) fetchCards();
    }, [householdId, enabled]);

    const openAdd = () => {
        setEditingId(null);
        setForm({ name: "", monthly_limit: "0" });
        setFormOpen(true);
    };

    const openEdit = (card: Card) => {
        setEditingId(card.id);
        setForm({ name: card.name, monthly_limit: (card.monthly_limit || 0).toString() });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!user) return;
        const baseData = {
            household_id: householdId,
            name: form.name,
            monthly_limit: parseFloat(form.monthly_limit),
            created_by: user.id,
            is_encrypted: false,
        };
        const data = await encryptRecord(baseData);

        let error;
        if (editingId) {
            const { id: _id, ...updateData } = data as any;
            ({ error } = await supabase.from("credit_cards").update(updateData).eq("id", editingId));
        } else {
            ({ error } = await supabase.from("credit_cards").insert(data));
        }

        if (error) {
            toast({ title: "Error", description: "Failed to save credit card", variant: "destructive" });
        } else {
            toast({ title: "Success", description: editingId ? "Credit card updated" : "Credit card added" });
            setFormOpen(false);
            fetchCards();
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from("credit_cards").delete().eq("id", deleteTarget.id);
        if (error) {
            toast({ title: "Error", description: "Failed to delete credit card", variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Credit card deleted" });
            fetchCards();
        }
        setDeleteTarget(null);
    };

    if (!enabled) {
        return (
            <SettingsCard eyebrow="Credit cards" dim>
                <p className="text-sm text-muted">
                    Enable credit cards in Extra features to manage cards and import statements.
                </p>
            </SettingsCard>
        );
    }

    return (
        <>
            <SettingsCard
                eyebrow="Credit cards"
                eyebrowRight={
                    <Button size="sm" variant="ghost" onClick={openAdd} className="-mr-2 h-7">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                }
                contentClassName="p-0"
            >
                {cards.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-muted text-center">
                        No credit cards yet. Add one to import statements during Monthly Review.
                    </p>
                ) : (
                    <SettingsList>
                        {cards.map(card => (
                            <SettingsListItem
                                key={card.id}
                                icon={<CreditCardIcon className="h-5 w-5" />}
                                title={card.name}
                                value={`${fmtKr(card.monthly_limit, currency)}/mo limit`}
                                onClick={() => openEdit(card)}
                            />
                        ))}
                    </SettingsList>
                )}
            </SettingsCard>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit" : "Add"} credit card</DialogTitle>
                        <DialogDescription>
                            Configure a credit card with a monthly spending limit.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Card name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., Norwegian Bank, Visa Gold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Monthly limit</Label>
                            <Input
                                type="number"
                                value={form.monthly_limit}
                                onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
                        <Button onClick={handleSave} className="w-full">
                            {editingId ? "Update" : "Add"}
                        </Button>
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                                Cancel
                            </Button>
                            {editingId && (
                                <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => {
                                        const card = cards.find(c => c.id === editingId);
                                        if (card) {
                                            setDeleteTarget({ id: card.id, name: card.name });
                                            setFormOpen(false);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete credit card?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deleteTarget?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
