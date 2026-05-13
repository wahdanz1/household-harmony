/**
 * DemoEncryptionCard - Overview component for demo mode
 * 
 * Shows encryption information and lets users view raw encrypted data.
 * Only visible when is_demo_mode is true.
 */

import { useState, useEffect } from "react";
import { Lock, Eye, Shield, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ShowEncryptedDataButton } from "./ShowEncryptedDataButton";
import { isDemoMode as checkDemoMode } from "@/utils/demoMode";

export const DemoEncryptionCard = ({ householdId }: { householdId: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [encryptedSample, setEncryptedSample] = useState<{
        table: string;
        field: string;
        value: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);

    // Only show in demo mode
    const isDemoMode = checkDemoMode();
    if (!isDemoMode) return null;

    const fetchEncryptedSample = async () => {
        setLoading(true);
        try {
            // Fetch first income source's encrypted default_amount
            const { data, error } = await supabase
                .from("income_sources")
                .select("encrypted_default_amount")
                .eq("household_id", householdId)
                .limit(1)
                .single();

            if (!error && data?.encrypted_default_amount) {
                setEncryptedSample({
                    table: "income_sources",
                    field: "encrypted_default_amount",
                    value: data.encrypted_default_amount,
                });
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = () => {
        setIsOpen(true);
        fetchEncryptedSample();
    };

    return (
        <>
            <Card className="p-4 bg-gradient-to-r from-accent/10 to-accent/5 border-accent/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-accent/20">
                            <Shield className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">End-to-End Encryption</p>
                            <p className="text-xs text-muted">
                                Your data is encrypted with AES-256-GCM
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpen}
                        className="gap-2"
                    >
                        <Eye className="h-4 w-4" />
                        View Info
                    </Button>
                </div>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-accent" />
                            Real Encryption Proof
                        </DialogTitle>
                        <DialogDescription>
                            This is the actual ciphertext stored in the database.
                            Your financial data never exists in plaintext on the server.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Raw Encrypted Data */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted">
                                <Database className="h-4 w-4" />
                                <span>
                                    Table: <code className="text-accent">{encryptedSample?.table || "..."}</code>
                                    {" / "}
                                    Field: <code className="text-accent">{encryptedSample?.field || "..."}</code>
                                </span>
                            </div>
                            <div className="p-3 rounded-md bg-surface-2/50 border border-line font-mono text-xs break-all max-h-32 overflow-auto">
                                {loading ? (
                                    <span className="text-muted">Loading...</span>
                                ) : encryptedSample?.value ? (
                                    encryptedSample.value.length > 150
                                        ? encryptedSample.value.substring(0, 150) + "..."
                                        : encryptedSample.value
                                ) : (
                                    "No encrypted data found"
                                )}
                            </div>
                        </div>

                        {/* Technical Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted">Algorithm:</span>
                                <p className="font-medium">AES-256-GCM</p>
                            </div>
                            <div>
                                <span className="text-muted">Key Derivation:</span>
                                <p className="font-medium">PBKDF2 (100k iter)</p>
                            </div>
                            <div>
                                <span className="text-muted">Key Storage:</span>
                                <p className="font-medium">Browser only</p>
                            </div>
                            <div>
                                <span className="text-muted">Server Access:</span>
                                <p className="font-medium text-accent">None</p>
                            </div>
                        </div>

                        {/* Explanation */}
                        <div className="p-3 rounded-md bg-accent/5 border border-accent/20 text-sm">
                            <p className="text-muted">
                                Household Harmony encrypts all sensitive data in your browser
                                before sending it to the database. Only you can decrypt it
                                with your vault password.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
