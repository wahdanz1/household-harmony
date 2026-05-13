import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface EditFinancialMonthDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentDay: number;
    onSave: (newDay: number) => Promise<void> | void;
}

export const EditFinancialMonthDialog = ({ open, onOpenChange, currentDay, onSave }: EditFinancialMonthDialogProps) => {
    const [value, setValue] = useState<number>(currentDay);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setValue(currentDay);
            setError(null);
        }
    }, [open, currentDay]);

    const handleSave = async () => {
        if (value < 1 || value > 28) {
            setError("Pick a day between 1 and 28.");
            return;
        }
        if (value === currentDay) {
            onOpenChange(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(value);
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit financial month start</DialogTitle>
                    <DialogDescription>
                        The day each financial month begins. Default is the 25th — e.g., Nov 25 through Dec 24 counts as "December".
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="edit-fm-day">Start day</Label>
                    <Input
                        id="edit-fm-day"
                        type="number"
                        min={1}
                        max={28}
                        value={value}
                        onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                        autoFocus
                    />
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <p className="text-xs text-muted">
                        Affects when income and expenses are grouped into a given month. Members of the household share this setting.
                    </p>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
