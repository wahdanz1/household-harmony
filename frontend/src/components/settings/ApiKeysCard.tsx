import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Eye, EyeOff, Check, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// Type for API key record (since Supabase types may not be regenerated yet)
interface ApiKeyRecord {
    id: string;
    user_id: string;
    household_id: string;
    provider: string;
    encrypted_key: string | null;
    key_iv: string | null;
    is_encrypted: boolean;
    created_at: string;
    updated_at: string;
}

export const ApiKeysCard = () => {
    const { user } = useAuth();
    const { household } = useHousehold();
    const { encrypt, decrypt, isUnlocked } = useEncryption();

    const [geminiKey, setGeminiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchApiKey();
    }, [user, household, isUnlocked]);

    const fetchApiKey = async () => {
        if (!user || !household) return;

        setLoading(true);

        // Use 'any' cast to work around missing Supabase types
        const { data, error } = await (supabase as any)
            .from("user_api_keys")
            .select("*")
            .eq("user_id", user.id)
            .eq("provider", "gemini")
            .maybeSingle();

        if (data) {
            const record = data as ApiKeyRecord;
            setHasKey(true);
            // Decrypt key if encrypted and vault is unlocked
            if (record.is_encrypted && isUnlocked && record.encrypted_key) {
                try {
                    const decrypted = await decrypt(record.encrypted_key);
                    setGeminiKey(decrypted || "");
                } catch (e) {
                    console.error("Failed to decrypt API key:", e);
                    setGeminiKey(""); // Show empty if can't decrypt
                }
            } else if (!record.is_encrypted && record.encrypted_key) {
                // Legacy unencrypted key
                setGeminiKey(record.encrypted_key);
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!user || !household || !geminiKey.trim()) return;

        setSaving(true);
        try {
            let keyData: Record<string, any> = {
                user_id: user.id,
                household_id: household.id,
                provider: "gemini",
                updated_at: new Date().toISOString(),
            };

            // Encrypt key if vault is unlocked
            if (isUnlocked) {
                const encrypted = await encrypt(geminiKey);
                if (encrypted) {
                    keyData.encrypted_key = encrypted;
                    keyData.is_encrypted = true;
                } else {
                    // Fallback to unencrypted if encryption fails
                    keyData.encrypted_key = geminiKey;
                    keyData.is_encrypted = false;
                }
            } else {
                // Store unencrypted (not recommended, but fallback)
                keyData.encrypted_key = geminiKey;
                keyData.is_encrypted = false;
            }

            // Use 'any' cast to work around missing Supabase types
            const { error } = await (supabase as any)
                .from("user_api_keys")
                .upsert(keyData, { onConflict: "user_id,provider" });

            if (error) throw error;

            setHasKey(true);
            toast.success("API key saved successfully");
        } catch (error) {
            console.error("Failed to save API key:", error);
            toast.error("Failed to save API key");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;

        // Use 'any' cast to work around missing Supabase types
        const { error } = await (supabase as any)
            .from("user_api_keys")
            .delete()
            .eq("user_id", user.id)
            .eq("provider", "gemini");

        if (!error) {
            setGeminiKey("");
            setHasKey(false);
            toast.success("API key removed");
        }
    };

    if (loading) {
        return (
            <Card>
                <p className="text-muted-foreground">Loading...</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Gemini API Key */}
            <Card>
                <div className="flex items-center gap-3 mb-4">
                    <Key className="h-5 w-5 text-primary" />
                    <div>
                        <h3>Gemini API Key</h3>
                        <p className="text-sm text-muted-foreground">Used for AI-powered features like invoice parsing</p>
                    </div>
                </div>



                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gemini-key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="gemini-key"
                                name="gemini-api-key"
                                type={showKey ? "text" : "password"}
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                placeholder={hasKey ? "••••••••••••••••" : "Enter your Gemini API key"}
                                className="pr-10"
                                autoComplete="off"
                                data-form-type="other"
                                data-lpignore="true"
                                data-1p-ignore="true"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={saving || !geminiKey.trim()}>
                            <Check className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : hasKey ? "Update Key" : "Save Key"}
                        </Button>
                        {hasKey && (
                            <Button variant="outline" onClick={handleDelete}>
                                Remove
                            </Button>
                        )}
                    </div>

                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                        Get a free Gemini API key <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                {hasKey && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-green-500">
                        <Check className="h-4 w-4" />
                        <span>API key configured</span>
                    </div>
                )}
            </Card>
        </div>
    );
};
