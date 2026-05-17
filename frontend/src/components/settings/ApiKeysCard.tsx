import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Eye, EyeOff, Check, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Type for API key record
interface ApiKeyRecord {
    id: string;
    user_id: string;
    household_id: string;
    provider: "groq" | "gemini";
    encrypted_key: string | null;
    key_iv: string | null;
    is_encrypted: boolean;
    created_at: string;
    updated_at: string;
}

type LLMProvider = "groq" | "gemini";

const providerConfig: Record<LLMProvider, { name: string; helpUrl: string; helpText: string }> = {
    groq: {
        name: "Groq",
        helpUrl: "https://console.groq.com/keys",
        helpText: "Get a free Groq API key",
    },
    gemini: {
        name: "Gemini",
        helpUrl: "https://aistudio.google.com/app/apikey",
        helpText: "Get a free Gemini API key",
    },
};

export const ApiKeysCard = () => {
    const { user } = useAuth();
    const { household } = useHousehold();
    const { encrypt, decrypt, isUnlocked } = useEncryption();

    const [provider, setProvider] = useState<LLMProvider>("groq");
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, household, isUnlocked]);

    const fetchApiKey = async () => {
        if (!user || !household) return;

        setLoading(true);
        // Reset state before fetching
        setHasKey(false);
        setApiKey("");

        // Fetch the most recently updated key for this user
        const { data, error } = await (supabase as any)
            .from("user_api_keys")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Failed to fetch API key:", error);
            setLoading(false);
            return;
        }

        if (data) {
            const record = data as ApiKeyRecord;
            setHasKey(true);
            setProvider(record.provider || "gemini");
            // API keys are now encrypted with backend master key
            // Frontend cannot and should not decrypt them
            // The field stays empty, but "configured" status shows
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!user || !household || !apiKey.trim()) return;

        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Please log in again");
                return;
            }

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/api-keys`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        api_key: apiKey,
                        provider: provider,
                        household_id: household.id,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || "Failed to save API key");
            }

            setHasKey(true);
            toast.success(`${providerConfig[provider].name} API key saved securely`);
        } catch (error) {
            console.error("Failed to save API key:", error);
            toast.error(error instanceof Error ? error.message : "Failed to save API key");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Please log in again");
                return;
            }

            const response = await fetch(
                `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/api-keys/${provider}`,
                {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${session.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to delete API key");
            }

            setApiKey("");
            setHasKey(false);
            toast.success("API key removed");
        } catch (error) {
            console.error("Failed to delete API key:", error);
            toast.error("Failed to delete API key");
        }
    };

    if (loading) {
        return (
            <Card>
                <p className="text-muted">Loading...</p>
            </Card>
        );
    }

    const currentConfig = providerConfig[provider];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-accent" />
                        LLM API Key
                    </CardTitle>
                    <CardDescription>Used for AI-powered features like invoice parsing</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="llm-provider">LLM Provider</Label>
                        <Select
                            value={provider}
                            onValueChange={(v) => setProvider(v as LLMProvider)}
                        >
                            <SelectTrigger id="llm-provider">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="groq">
                                    Groq (Recommended - Fast & Free)
                                </SelectItem>
                                <SelectItem value="gemini">
                                    Google Gemini
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <Label htmlFor="api-key">{currentConfig.name} API Key</Label>
                        <div className="relative">
                            <Input
                                id="api-key"
                                name="llm-api-key"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={hasKey ? "Enter new key to update" : `Enter your ${currentConfig.name} API key`}
                                className="pr-10"
                                autoComplete="off"
                                data-form-type="other"
                                data-lpignore="true"
                                data-1p-ignore="true"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                            >
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                            <Check className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : hasKey ? "Update Key" : "Save Key"}
                        </Button>
                        {hasKey && (
                            <Button variant="outline" onClick={handleDelete}>
                                Remove
                            </Button>
                        )}
                    </div>

                    {/* Help Link */}
                    <a
                        href={currentConfig.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                        {currentConfig.helpText} <ExternalLink className="h-3 w-3" />
                    </a>

                    {hasKey && (
                        <div className="flex items-center gap-2 text-sm text-accent">
                            <Check className="h-4 w-4" />
                            <span>{currentConfig.name} API key configured</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
