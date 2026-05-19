import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, ExternalLink, AlertTriangle, Trash2 } from "lucide-react";
import { SettingsCard } from "./SettingsCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export const ApiKeysCard = () => {
    const { user } = useAuth();
    const { household } = useHousehold();

    const [provider, setProvider] = useState<LLMProvider>("groq");
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [configuredProviders, setConfiguredProviders] = useState<Set<LLMProvider>>(new Set());
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [removing, setRemoving] = useState(false);

    const hasKey = configuredProviders.has(provider);

    useEffect(() => {
        fetchApiKeys();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, household]);

    const fetchApiKeys = async () => {
        if (!user || !household) return;
        setLoading(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from("user_api_keys")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Failed to fetch API keys:", error);
            setLoading(false);
            return;
        }

        const rows = (data as ApiKeyRecord[]) || [];
        const configured = new Set<LLMProvider>();
        for (const row of rows) {
            if (row.provider === "groq" || row.provider === "gemini") {
                configured.add(row.provider);
            }
        }
        setConfiguredProviders(configured);
        // Default the dropdown to the most-recently-updated provider, if any.
        if (rows[0]?.provider === "groq" || rows[0]?.provider === "gemini") {
            setProvider(rows[0].provider);
        }
        setLoading(false);
    };

    const humanizeError = (err: unknown): string => {
        if (err instanceof TypeError && /fetch/i.test(err.message)) {
            return "Couldn't reach the API server. Make sure the backend is running on :8000.";
        }
        if (err instanceof Error) return err.message;
        return "Failed to save API key.";
    };

    const handleSave = async () => {
        if (!user || !household || !apiKey.trim()) return;
        setSaving(true);
        setSaveError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setSaveError("Your session expired. Please log in again.");
                return;
            }

            const response = await fetch(`${BACKEND_URL}/api/api-keys`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    provider,
                    household_id: household.id,
                }),
            });

            if (!response.ok) {
                const detail = await response.json().catch(() => ({}));
                throw new Error(detail.detail || `Save failed (${response.status})`);
            }

            setApiKey("");
            toast.success(`${providerConfig[provider].name} API key saved`);
            await fetchApiKeys();
        } catch (err) {
            console.error("Failed to save API key:", err);
            setSaveError(humanizeError(err));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        setSaveError(null);
        setRemoving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setSaveError("Your session expired. Please log in again.");
                return;
            }

            const response = await fetch(`${BACKEND_URL}/api/api-keys/${provider}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (!response.ok) throw new Error(`Remove failed (${response.status})`);

            setApiKey("");
            toast.success(`${providerConfig[provider].name} API key removed`);
            await fetchApiKeys();
            setConfirmRemove(false);
        } catch (err) {
            console.error("Failed to delete API key:", err);
            setSaveError(humanizeError(err));
        } finally {
            setRemoving(false);
        }
    };

    const eyebrowRight = configuredProviders.size > 0 ? (
        <div className="flex items-center gap-1.5">
            {Array.from(configuredProviders).map((p) => (
                <span
                    key={p}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-accent/15 text-accent normal-case"
                >
                    <Check className="h-3 w-3" />
                    {providerConfig[p].name}
                </span>
            ))}
        </div>
    ) : undefined;

    if (loading) {
        return (
            <SettingsCard eyebrow="LLM API key">
                <p className="text-sm text-muted">Loading…</p>
            </SettingsCard>
        );
    }

    const currentConfig = providerConfig[provider];

    return (
        <>
            <SettingsCard eyebrow="LLM API key" eyebrowRight={eyebrowRight}>
                <div className="space-y-4">
                    <p className="text-sm text-muted -mt-1">
                        Used for AI-powered features like invoice parsing.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="llm-provider">Provider</Label>
                            <Select value={provider} onValueChange={(v) => { setProvider(v as LLMProvider); setSaveError(null); }}>
                                <SelectTrigger id="llm-provider">
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="groq">Groq (Recommended — Fast &amp; Free)</SelectItem>
                                    <SelectItem value="gemini">Google Gemini</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="api-key">{currentConfig.name} API key</Label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="api-key"
                                        name="llm-api-key"
                                        type="text"
                                        value={apiKey}
                                        onChange={(e) => { setApiKey(e.target.value); if (saveError) setSaveError(null); }}
                                        placeholder={hasKey ? "Enter new key to update" : `Enter your ${currentConfig.name} API key`}
                                        className={`pr-10 ${showKey ? "" : "[-webkit-text-security:disc]"}`}
                                        autoComplete="off"
                                        spellCheck={false}
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        data-form-type="other"
                                        data-lpignore="true"
                                        data-1p-ignore="true"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                                        aria-label={showKey ? "Hide key" : "Show key"}
                                    >
                                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {hasKey && (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemove(true)}
                                        className="shrink-0 h-9 w-9 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                        title={`Remove ${currentConfig.name} API key`}
                                        aria-label={`Remove ${currentConfig.name} API key`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <a
                                href={currentConfig.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                            >
                                {currentConfig.helpText} <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>

                    {saveError && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 text-danger text-xs">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{saveError}</span>
                        </div>
                    )}

                    <div>
                        <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                            <Check className="h-4 w-4 mr-2" />
                            {saving ? "Saving…" : hasKey ? "Update key" : "Save key"}
                        </Button>
                    </div>
                </div>
            </SettingsCard>

            <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                title={`Remove ${currentConfig.name} API key?`}
                description="You'll need to re-enter it to use AI features that depend on this provider."
                confirmLabel="Remove"
                busyLabel="Removing…"
                busy={removing}
                onConfirm={handleDelete}
            />
        </>
    );
};
