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
    busyLabel?: string;
    cancelLabel?: string;
    variant?: "destructive" | "default";
    onConfirm: () => void | Promise<void>;
    busy?: boolean;
    /** Optional "what's being discarded / affected" panel — surface-2 block
     *  with an eyebrow and a label-count list. Used by the wizard's exit
     *  confirm. Only renders rows where count > 0. */
    stakes?: {
        eyebrow?: string;
        items: Array<{ label: string; count: number }>;
    };
}

export const ConfirmDialog = ({
    open, onOpenChange, title, description,
    confirmLabel = "Delete", busyLabel,
    cancelLabel = "Cancel",
    variant = "destructive", onConfirm, busy = false,
    stakes,
}: ConfirmDialogProps) => {
    const stakeRows = stakes?.items.filter((s) => s.count > 0) ?? [];
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                {stakes && stakeRows.length > 0 && (
                    <div className="rounded-[10px] border border-line bg-surface-2 px-3.5 py-3">
                        {stakes.eyebrow && (
                            <span className="text-[10.5px] font-semibold tracking-[0.08em] uppercase text-muted">
                                {stakes.eyebrow}
                            </span>
                        )}
                        <ul className="mt-1.5 space-y-0.5">
                            {stakeRows.map((s) => (
                                <li key={s.label} className="flex items-baseline justify-between text-[13px] py-0.5">
                                    <span className="text-ink-2">{s.label}</span>
                                    <span className="font-mono tabular-nums font-semibold text-ink">{s.count}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button variant={variant} onClick={onConfirm} disabled={busy}>
                        {busy ? (busyLabel ?? "Working…") : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
