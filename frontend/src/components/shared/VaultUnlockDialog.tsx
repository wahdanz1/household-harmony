/**
 * VaultUnlockDialog Component
 * 
 * A dialog that prompts the user to re-enter their password to unlock the vault.
 * Used when the vault auto-locks due to inactivity or other reasons.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertContent, AlertDescription } from "@/components/ui/alert";
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useAuth } from "@/contexts/AuthContext";

interface VaultUnlockDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export const VaultUnlockDialog = ({ open, onOpenChange, onSuccess }: VaultUnlockDialogProps) => {
    const { user } = useAuth();
    const { unlockWithPassword } = useEncryption();
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUnlock = async () => {
        if (!user || !password) return;

        setLoading(true);
        setError(null);

        try {
            const success = await unlockWithPassword(password, user.id);
            if (success) {
                setPassword("");
                onOpenChange(false);
                onSuccess?.();
            } else {
                setError("Incorrect password. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to unlock vault");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && password) {
            handleUnlock();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Unlock Vault
                    </DialogTitle>
                    <DialogDescription>
                        Your vault has been locked. Enter your password to unlock and access your encrypted data.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertContent>
                                <AlertDescription>{error}</AlertDescription>
                            </AlertContent>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="unlock-password">Password</Label>
                        <div className="relative">
                            <Input
                                id="unlock-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Enter your password"
                                autoFocus
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <Button onClick={handleUnlock} disabled={loading || !password} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Unlocking...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Unlock Vault
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

/**
 * VaultUnlockButton Component
 * 
 * A standalone button that opens the vault unlock dialog.
 * Use this in components that need vault access but are shown when vault is locked.
 */
interface VaultUnlockButtonProps {
    onSuccess?: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
    className?: string;
}

export const VaultUnlockButton = ({ onSuccess, variant = "default", className }: VaultUnlockButtonProps) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <>
            <Button variant={variant} onClick={() => setDialogOpen(true)} className={className}>
                <Lock className="h-4 w-4 mr-2" />
                Unlock Vault
            </Button>
            <VaultUnlockDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={onSuccess}
            />
        </>
    );
};
