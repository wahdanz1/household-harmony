import { useState } from "react";
import { Baby, Copy, Check, Plus, Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption, spaceScope } from "@/contexts/EncryptionContext";
import { useToast } from "@/hooks/use-toast";
import { isDemoMode } from "@/utils/demoMode";
import { PLACEHOLDERS } from "@/constants/ui";
import { SettingsBadge } from "./SettingsCard";
import { useCoParents, CoParent } from "@/hooks/useCoParents";
import { createCoParentSpace, createCoParentSpaceInvite } from "@/services/coparentSpaces";
import { generateSpaceInviteCode, formatSpaceInviteCode } from "@/services/encryption";

interface CoParentsSectionProps {
    householdId: string;
    enabled: boolean;
}

/**
 * Co-parents live in their own section rather than mixed into the member list:
 * a household member holds the household key and sees everything, a co-parent
 * holds only a space key. Keeping them visually separate is what stops that
 * difference from being mistaken for a formatting detail.
 */
export const CoParentsSection = ({ householdId, enabled }: CoParentsSectionProps) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { wrapSpaceDEKForInvite, loadScopeKey, isUnlocked } = useEncryption();
    const { coParents, refresh } = useCoParents(householdId, user?.id);

    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState("");
    const [inviting, setInviting] = useState<CoParent | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [issuedCode, setIssuedCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [revoking, setRevoking] = useState<CoParent | null>(null);

    const demoMode = isDemoMode();

    if (!enabled) return null;

    const resetInvite = () => {
        setInviting(null);
        setInviteEmail("");
        setPassword("");
        setIssuedCode(null);
        setCopied(false);
    };

    const handleAdd = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        const { error } = await supabase.from("co_parents").insert({ household_id: householdId, name });
        setBusy(false);
        if (error) {
            toast({ title: "Error", description: "Failed to add co-parent.", variant: "destructive" });
            return;
        }
        setNewName("");
        setShowAdd(false);
        refresh();
    };

    const handleInvite = async () => {
        if (!user || !inviting) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(inviteEmail)) {
            toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
            return;
        }
        if (!isUnlocked) {
            toast({ title: "Vault locked", description: "Unlock your vault before inviting.", variant: "destructive" });
            return;
        }
        if (!password) {
            toast({ title: "Password required", description: "Your password wraps the shared key.", variant: "destructive" });
            return;
        }

        setBusy(true);
        try {
            let spaceId = inviting.spaceId;

            // First invite for this co-parent creates the space. The password is
            // needed because the vault holds only the DEK, never the password,
            // so there is nothing else to wrap a brand-new key with.
            if (!spaceId) {
                const { space, dek } = await createCoParentSpace({
                    name: inviting.name,
                    userId: user.id,
                    password,
                });
                loadScopeKey(spaceScope(space.id), dek);

                const { error } = await supabase
                    .from("co_parents")
                    .update({ space_id: space.id })
                    .eq("id", inviting.id);
                if (error) throw new Error("Failed to link co-parent to the shared space.");

                spaceId = space.id;
            }

            const code = generateSpaceInviteCode();
            const wrapped = await wrapSpaceDEKForInvite(spaceId, code);
            if (!wrapped) {
                throw new Error("Could not prepare the shared key. Try unlocking again.");
            }

            await createCoParentSpaceInvite({
                spaceId,
                invitedEmail: inviteEmail,
                createdBy: user.id,
                code,
                wrapped,
            });

            setIssuedCode(code);
            refresh();
        } catch (err) {
            toast({
                title: "Invite failed",
                description: err instanceof Error ? err.message : "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    const handleRevoke = async () => {
        if (!revoking?.spaceId) return;
        setBusy(true);
        // Deleting the membership fires the trigger that drops their wrap.
        const { error } = await supabase
            .from("coparent_space_members")
            .delete()
            .eq("space_id", revoking.spaceId)
            .neq("user_id", user?.id ?? "");
        setBusy(false);
        if (error) {
            toast({ title: "Error", description: "Failed to revoke access.", variant: "destructive" });
            return;
        }
        toast({ title: "Access revoked", description: `${revoking.name} can no longer open the shared space.` });
        setRevoking(null);
        refresh();
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(formatSpaceInviteCode(code));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <div className="border-t border-line-2">
                <div className="px-5 py-2.5 flex items-center justify-between border-b border-line-2">
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] leading-[1.5] text-muted">
                        Co-parents · limited access
                    </p>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAdd(true)}
                        disabled={demoMode}
                        className="h-7 px-2 -my-1 text-accent-dk hover:text-accent-dk hover:bg-accent-tint"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add
                    </Button>
                </div>

                {coParents.length === 0 ? (
                    <div className="px-5 py-4">
                        <p className="text-sm text-muted">
                            A co-parent sees the kid schedule and only the costs you share with them — nothing else in your household.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-line-2">
                        {coParents.map(cp => (
                            <div key={cp.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Baby className="h-3.5 w-3.5 text-muted shrink-0" />
                                        <p className="font-semibold text-ink leading-tight truncate">{cp.name}</p>
                                        {cp.isLinked ? (
                                            <SettingsBadge tone="accent">Linked</SettingsBadge>
                                        ) : cp.pendingInvite ? (
                                            <SettingsBadge>Invite sent</SettingsBadge>
                                        ) : (
                                            <SettingsBadge>Not linked</SettingsBadge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted mt-0.5 truncate">
                                        {cp.isLinked
                                            ? "Can see the shared schedule and the costs you publish."
                                            : cp.pendingInvite
                                              ? `Waiting on ${cp.pendingInvite.email}`
                                              : "Not connected to an account yet."}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={demoMode}
                                        onClick={() => { setInviting(cp); setInviteEmail(cp.pendingInvite?.email ?? ""); }}
                                        className="h-8"
                                    >
                                        {cp.isLinked ? "Re-invite" : cp.pendingInvite ? "New code" : "Invite"}
                                    </Button>
                                    {cp.isLinked && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setRevoking(cp)}
                                            aria-label="Revoke access"
                                            className="h-8 w-8 text-muted hover:text-danger"
                                        >
                                            <ShieldOff className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={showAdd} onOpenChange={(o) => { if (!busy) { setShowAdd(o); if (!o) setNewName(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add a co-parent</DialogTitle>
                        <DialogDescription>
                            Just a name for now. Invite them to an account whenever you're ready.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="coparent-name">Name</Label>
                        <Input
                            id="coparent-name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !busy && handleAdd()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={busy || !newName.trim()}>Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!inviting} onOpenChange={(o) => { if (!o && !busy) resetInvite(); }}>
                <DialogContent>
                    {issuedCode ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Send this code to {inviting?.name}</DialogTitle>
                                <DialogDescription>
                                    It unlocks the shared space and is not stored anywhere — once you close this, it can't be shown again. Send it over a channel you trust. Expires in 72 hours.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 font-mono font-semibold text-ink text-center py-3 rounded bg-surface-2 tracking-wider">
                                    {formatSpaceInviteCode(issuedCode)}
                                </code>
                                <Button variant="ghost" size="icon" onClick={() => copyCode(issuedCode)} aria-label="Copy code">
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <DialogFooter>
                                <Button onClick={resetInvite}>Done</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Invite {inviting?.name}</DialogTitle>
                                <DialogDescription>
                                    They need an account with this email. Your password is needed to wrap the shared key — it never leaves your device.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="coparent-email">Their email address</Label>
                                    <Input
                                        id="coparent-email"
                                        type="email"
                                        placeholder={PLACEHOLDERS.EMAIL}
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coparent-password">Your password</Label>
                                    <Input
                                        id="coparent-password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && !busy && handleInvite()}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={resetInvite} disabled={busy}>Cancel</Button>
                                <Button onClick={handleInvite} disabled={busy}>
                                    {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create invite"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!revoking}
                onOpenChange={(o) => { if (!o && !busy) setRevoking(null); }}
                title={revoking ? `Revoke ${revoking.name}'s access?` : ""}
                description="They lose access to the shared schedule and published costs. You can invite them again later."
                confirmLabel="Revoke"
                busyLabel="Revoking…"
                onConfirm={handleRevoke}
                busy={busy}
            />
        </>
    );
};
