import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface EditNameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentName: string;
    onSave: (newName: string) => Promise<void> | void;
}

export const EditNameDialog = ({ open, onOpenChange, currentName, onSave }: EditNameDialogProps) => {
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
                    <DialogTitle>Edit name</DialogTitle>
                    <DialogDescription>
                        This is the name shown to other household members.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="edit-name-input">Name</Label>
                    <Input
                        id="edit-name-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
