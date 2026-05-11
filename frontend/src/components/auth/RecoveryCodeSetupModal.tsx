import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Copy, Check, Download, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface RecoveryCodeSetupModalProps {
    open: boolean;
    /** The plaintext code, generated and stored before this modal opens. */
    code: string | null;
    /** Fired when the user confirms they've saved it. */
    onConfirm: () => void;
}

export const RecoveryCodeSetupModal = ({ open, code, onConfirm }: RecoveryCodeSetupModalProps) => {
    const [acknowledged, setAcknowledged] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) { setAcknowledged(false); setCopied(false); }
    }, [open]);

    const words = useMemo(() => (code ? code.split(" ") : []), [code]);

    const handleCopy = async () => {
        if (!code) return;
        await navigator.clipboard.writeText(code);
        setCopied(true);
        toast.success("Recovery code copied");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!code) return;
        const blob = new Blob(
            [
                `Household Harmony — recovery code\n`,
                `Generated: ${new Date().toISOString()}\n\n`,
                `${code}\n\n`,
                `Keep this safe. If you forget your password, this 12-word phrase is the only way to recover your encrypted data. Store it somewhere you'll have access to later: password manager, paper note in a safe place, encrypted notes file.\n`,
            ],
            { type: "text/plain" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "household-harmony-recovery-code.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={open} onOpenChange={() => { /* not dismissible by overlay click */ }}>
            <DialogContent
                className="max-w-lg [&>button.absolute]:hidden"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center mb-2">
                        <KeyRound className="h-6 w-6 text-accent-dk" />
                    </div>
                    <DialogTitle>Save your recovery code</DialogTitle>
                    <DialogDescription>
                        If you forget your password, this 12-word phrase is the <strong>only</strong> way to
                        recover your encrypted data. We can't show it again.
                    </DialogDescription>
                </DialogHeader>

                <Card variant="flush" className="p-4 bg-surface-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 font-mono text-sm">
                        {words.map((w, i) => (
                            <div key={i} className="flex items-baseline gap-1.5">
                                <span className="text-xs text-muted-foreground tabular-nums w-4 text-right">{i + 1}.</span>
                                <span className="text-ink">{w}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                        Download .txt
                    </Button>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-[10px] bg-warning/10 text-warning-dk text-xs">
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        Store it in a password manager, on paper somewhere safe, or both. Losing
                        both your password and this code means losing access to your data.
                    </span>
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <Checkbox
                        checked={acknowledged}
                        onCheckedChange={(v) => setAcknowledged(v === true)}
                    />
                    <span>I've saved my recovery code somewhere safe.</span>
                </label>

                <Button disabled={!acknowledged} onClick={onConfirm} size="lg">
                    Continue
                </Button>
            </DialogContent>
        </Dialog>
    );
};
