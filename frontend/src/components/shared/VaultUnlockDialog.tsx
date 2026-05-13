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
import { Lock, LockOpen, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LockOpen className="h-5 w-5 text-accent-dk" />
                        Unlock vault
                    </DialogTitle>
                    <DialogDescription>
                        Enter your password to decrypt your data for this session.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => { e.preventDefault(); handleUnlock(); }}
                    className="space-y-4 pt-4"
                >
                    {/* Hidden username field so password managers know which
                        account this password belongs to and can autofill. */}
                    <input
                        type="email"
                        name="email"
                        autoComplete="username"
                        value={user?.email ?? ""}
                        readOnly
                        hidden
                    />

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
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoFocus
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" disabled={loading || !password} className="w-full">
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Unlocking…
                            </>
                        ) : (
                            <>
                                <LockOpen className="h-4 w-4 mr-2" />
                                Unlock vault
                            </>
                        )}
                    </Button>
                </form>
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
            <Button
                variant={variant}
                onClick={() => setDialogOpen(true)}
                className={cn("group", className)}
            >
                {/* Icon swap on hover: Lock → LockOpen via cross-fade */}
                <span className="relative inline-flex h-4 w-4 shrink-0">
                    <Lock
                        aria-hidden
                        className="absolute inset-0 h-4 w-4 transition-opacity duration-200 group-hover:opacity-0"
                    />
                    <LockOpen
                        aria-hidden
                        className="absolute inset-0 h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                </span>
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
