import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Shuffle } from "lucide-react";
import { generateHouseholdName } from "@/utils/householdNames";

interface EditHouseholdNameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentName: string;
    onSave: (newName: string) => Promise<void> | void;
}

export const EditHouseholdNameDialog = ({ open, onOpenChange, currentName, onSave }: EditHouseholdNameDialogProps) => {
    const [value, setValue] = useState(currentName);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setValue(currentName);
    }, [open, currentName]);

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === currentName) {
            onOpenChange(false);
            return;
        }
        setSaving(true);
        try {
            await onSave(trimmed);
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit household name</DialogTitle>
                    <DialogDescription>What this household is called, visible to all members.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <Label htmlFor="edit-household-name">Name</Label>
                    <Input
                        id="edit-household-name"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setValue(generateHouseholdName())} className="w-full justify-center">
                        <Shuffle className="h-4 w-4 mr-2" />
                        Generate random name
                    </Button>
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
