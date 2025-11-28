import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface OneTimeIncomeCardProps {
    oneTimeIncomes: any[];
    currency: string;
    coParents: any[];
    saving: boolean;
    onAdd: (data: {
        name: string;
        amount: string;
        notes: string;
        isShared: boolean;
        coParentId: string;
        sharePercentage: string;
    }) => void;
    onDelete: (id: string) => void;
}

export const OneTimeIncomeCard = ({
    oneTimeIncomes,
    currency,
    coParents,
    saving,
    onAdd,
    onDelete,
}: OneTimeIncomeCardProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");
    const [isShared, setIsShared] = useState(false);
    const [coParentId, setCoParentId] = useState("");
    const [sharePercentage, setSharePercentage] = useState("50");

    const handleAdd = () => {
        onAdd({
            name,
            amount,
            notes,
            isShared,
            coParentId,
            sharePercentage,
        });
        // Reset form
        setDialogOpen(false);
        setName("");
        setAmount("");
        setNotes("");
        setIsShared(false);
        setCoParentId("");
        setSharePercentage("50");
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-success" />
                            One-Time Income
                        </CardTitle>
                        <CardDescription>
                            Gift money, lottery wins, or other temporary income
                        </CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="w-full sm:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Income
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add One-Time Income</DialogTitle>
                                <DialogDescription>
                                    Record temporary income like gifts or windfalls
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="one-time-name">Name *</Label>
                                    <Input
                                        id="one-time-name"
                                        placeholder="e.g., Birthday gift, Lottery win"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="one-time-amount">Amount ({currency}) *</Label>
                                    <Input
                                        id="one-time-amount"
                                        type="number"
                                        placeholder="0"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="one-time-notes">Notes (optional)</Label>
                                    <Textarea
                                        id="one-time-notes"
                                        placeholder="Additional details..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4 border-t border-border pt-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={isShared}
                                            onCheckedChange={setIsShared}
                                        />
                                        <Label>Shared income (you keep {sharePercentage}%)</Label>
                                    </div>

                                    {isShared && (
                                        <>
                                            <div className="space-y-2">
                                                <Label>Co-Parent</Label>
                                                <Select value={coParentId} onValueChange={setCoParentId}>
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
                                                <Label>Your Share (%)</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={sharePercentage}
                                                    onChange={(e) => setSharePercentage(e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    You keep {sharePercentage}%, send {100 - parseFloat(sharePercentage || "0")}% to co-parent
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAdd} disabled={saving}>
                                    {saving ? "Adding..." : "Add Income"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {oneTimeIncomes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <p className="text-sm">No one-time income recorded this month</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {oneTimeIncomes.map((income) => (
                            <div
                                key={income.id}
                                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background/40"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{income.one_time_name}</p>
                                        {income.is_shared && (
                                            <Badge variant="secondary">{income.share_percentage}% yours</Badge>
                                        )}
                                    </div>
                                    {income.notes && (
                                        <p className="text-sm text-muted-foreground mt-1">{income.notes}</p>
                                    )}
                                    <p className="font-semibold text-success mt-1">
                                        {income.is_shared
                                            ? (parseFloat(income.amount) * parseFloat(income.share_percentage?.toString() || "50") / 100).toFixed(0)
                                            : parseFloat(income.amount).toFixed(0)} {currency}
                                        {income.is_shared && (
                                            <span className="text-muted-foreground text-sm font-normal"> (of {parseFloat(income.amount).toFixed(0)} total)</span>
                                        )}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onDelete(income.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
