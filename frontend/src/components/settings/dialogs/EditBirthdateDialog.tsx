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
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Loader2 } from "lucide-react";

interface EditBirthdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBirthdate?: Date;
    onSave: (newBirthdate: Date | undefined) => Promise<void> | void;
}

export const EditBirthdateDialog = ({ open, onOpenChange, currentBirthdate, onSave }: EditBirthdateDialogProps) => {
    const [value, setValue] = useState<Date | undefined>(currentBirthdate);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setValue(currentBirthdate);
    }, [open, currentBirthdate]);

    const handleSave = async () => {
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
                    <DialogTitle>Edit date of birth</DialogTitle>
                    <DialogDescription>
                        Used for age-aware features. Not shown to other household members.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="edit-birthdate-input">Date of birth</Label>
                    <DateInput value={value} onChange={setValue} placeholder="YYYY-MM-DD" />
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
