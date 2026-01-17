/**
 * ShowEncryptedDataButton - Demo mode only component
 * 
 * Shows a button that fetches and displays raw encrypted data from the database.
 * Proves to portfolio viewers that encryption is real, not UI theater.
 */

import { useState } from "react";
import { Eye, Lock, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface ShowEncryptedDataButtonProps {
    /** The record ID to fetch */
    recordId: string;
    /** The table name (e.g., "income_sources", "expenses") */
    tableName: string;
    /** The encrypted field name to display (e.g., "encrypted_name") */
    fieldName: string;
    /** Display label for the field */
    displayLabel?: string;
    /** Size variant */
    size?: "sm" | "default" | "icon";
}

export const ShowEncryptedDataButton = ({
    recordId,
    tableName,
    fieldName,
    displayLabel,
    size = "icon",
}: ShowEncryptedDataButtonProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [encryptedValue, setEncryptedValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Only show in demo mode
    const isDemoMode = localStorage.getItem("is_demo_mode") === "true";
    if (!isDemoMode) return null;

    const fetchEncryptedData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(tableName as any)
                .select(fieldName)
                .eq("id", recordId)
                .single();

            if (error) throw error;
            setEncryptedValue(data?.[fieldName] || null);
        } catch (err) {
            console.error("Failed to fetch encrypted data:", err);
            setEncryptedValue("Error: Could not fetch encrypted data");
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        fetchEncryptedData();
    };

    const handleCopy = async () => {
        if (encryptedValue) {
            await navigator.clipboard.writeText(encryptedValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Truncate for display
    const displayValue = encryptedValue
        ? encryptedValue.length > 120
            ? encryptedValue.substring(0, 120) + "..."
            : encryptedValue
        : null;

    return (
        <>
            <Button
                variant="ghost"
                size={size}
                onClick={handleOpen}
                className="text-muted-foreground hover:text-primary"
                title="View raw encrypted data (demo only)"
            >
                <Eye className="h-4 w-4" />
                {size !== "icon" && <span className="ml-2">View Encrypted</span>}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            Raw Encrypted Data
                        </DialogTitle>
                        <DialogDescription>
                            This is the actual encrypted ciphertext stored in the database.
                            Your data never exists in plaintext on the server.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">
                                    Field: {displayLabel || fieldName}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopy}
                                    disabled={!encryptedValue}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            <div className="p-3 rounded-md bg-muted/50 border border-border font-mono text-xs break-all">
                                {loading ? (
                                    <span className="text-muted-foreground">Loading...</span>
                                ) : (
                                    displayValue || "No encrypted data found"
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Algorithm:</span>
                                <p className="font-medium">AES-256-GCM</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Key Derivation:</span>
                                <p className="font-medium">PBKDF2 (100k iterations)</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                            <p className="text-muted-foreground">
                                This ciphertext can only be decrypted with your vault password.
                                Even database administrators cannot read your financial data.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
