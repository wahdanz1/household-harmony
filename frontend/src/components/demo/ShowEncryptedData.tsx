import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ShowEncryptedDataProps {
    /**
     * The table name to fetch from
     */
    table: string;

    /**
     * The column that contains encrypted data
     */
    encryptedColumn: string;

    /**
     * The label to display for the encrypted data
     */
    label: string;

    /**
     * Optional filter to get specific row
     */
    filter?: { column: string; value: any };
}

export const ShowEncryptedData = ({
    table,
    encryptedColumn,
    label,
    filter
}: ShowEncryptedDataProps) => {
    const [encryptedValue, setEncryptedValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const isDemoMode = localStorage.getItem('is_demo_mode') === 'true';

    if (!isDemoMode) return null;

    const fetchEncryptedData = async () => {
        setLoading(true);
        try {
            let query = supabase.from(table as any).select(encryptedColumn);

            if (filter) {
                query = query.eq(filter.column, filter.value);
            }

            const result = await query.limit(1).single();

            if (result.error) throw result.error;

            const rowData = result.data;
            if (!rowData) {
                setEncryptedValue("(No data returned from database)");
                return;
            }

            // rowData is confirmed non-null, create a typed reference
            const safeData = rowData as unknown as Record<string, unknown>;
            if (encryptedColumn in safeData) {
                const value = safeData[encryptedColumn];
                if (typeof value === 'string') {
                    setEncryptedValue(value);
                } else {
                    setEncryptedValue("(Data exists but is not a string)");
                }
            } else {
                setEncryptedValue("(No encrypted data found - may not be encrypted yet)");
            }
        } catch (error: any) {
            console.error("Failed to fetch encrypted data:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to fetch encrypted data",
                variant: "destructive"
            });
            setEncryptedValue(`(Error: ${error.message || 'Unknown error'})`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (encryptedValue) {
            await navigator.clipboard.writeText(encryptedValue);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({
                title: "Copied!",
                description: "Encrypted value copied to clipboard"
            });
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEncryptedData}
                >
                    <Eye className="h-3 w-3 mr-1.5" />
                    Show Encrypted Data
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        🔒 Real AES-256-GCM Encryption
                    </DialogTitle>
                    <DialogDescription>
                        This is the actual encrypted value stored in the database. Not a demo trick - this is real client-side encryption.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium">{label}</p>
                            <Badge variant="soft">Encrypted</Badge>
                        </div>

                        {loading ? (
                            <div className="bg-muted/30 p-4 rounded-md animate-pulse">
                                <div className="h-4 bg-muted rounded w-3/4"></div>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="bg-muted/30 p-4 rounded-md font-mono text-xs break-all max-h-48 overflow-y-auto">
                                    {encryptedValue || "Click 'Show Encrypted Data' to load..."}
                                </div>
                                {encryptedValue && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="absolute top-2 right-2"
                                        onClick={handleCopy}
                                    >
                                        {copied ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-primary/5 p-4 rounded-md space-y-2">
                        <h4 className="font-semibold text-sm">What you're seeing:</h4>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• Data is encrypted <strong>in your browser</strong> using AES-256-GCM</li>
                            <li>• The server only stores this ciphertext - never sees plaintext</li>
                            <li>• Your password derives the encryption key (PBKDF2)</li>
                            <li>• This is zero-knowledge architecture in action</li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
