import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "destructive" | "default";
    onConfirm: () => void | Promise<void>;
    busy?: boolean;
}

export const ConfirmDialog = ({
    open, onOpenChange, title, description,
    confirmLabel = "Delete", cancelLabel = "Cancel",
    variant = "destructive", onConfirm, busy = false,
}: ConfirmDialogProps) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                    {cancelLabel}
                </Button>
                <Button variant={variant} onClick={onConfirm} disabled={busy}>
                    {busy ? "Deleting…" : confirmLabel}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
