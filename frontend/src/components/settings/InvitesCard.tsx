import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Copy, Check, Trash2, Loader2, Baby } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useToast } from "@/hooks/use-toast";
import { isDemoMode } from "@/utils/demoMode";
import { PLACEHOLDERS } from "@/constants/ui";
import { SettingsCard, SettingsBadge } from "./SettingsCard";
import { useCoParents } from "@/hooks/useCoParents";
import { useEncryption as useEncryptionCtx, spaceScope } from "@/contexts/EncryptionContext";
import { inviteNewCoParent } from "@/services/coparentSpaces";
import { generateSpaceInviteCode, formatSpaceInviteCode } from "@/services/encryption";

interface Invite {
    id: string;
    invite_code: string;
    invited_email: string | null;
    status: string;
    expires_at: string;
    created_at: string;
}

interface InvitesCardProps {
    householdId: string;
    invites: Invite[];
    isOwner: boolean;
    /** Co-parent invites ride on the shared-expenses feature flag. */
    sharedExpensesEnabled?: boolean;
    onUpdate: () => void;
}

export const InvitesCard = ({ householdId, invites, isOwner, sharedExpensesEnabled, onUpdate }: InvitesCardProps) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const { wrapDEKForInvite, isUnlocked } = useEncryption();
    const { wrapKeyForSelf, wrapSpaceDEKForInvite, loadScopeKey } = useEncryptionCtx();
    const { coParents, refresh: refreshCoParents } = useCoParents(householdId, user?.id);
    const [showCoParentDialog, setShowCoParentDialog] = useState(false);
    const [coParentEmail, setCoParentEmail] = useState("");
    const [issuedCode, setIssuedCode] = useState<string | null>(null);
    const [showEmailDialog, setShowEmailDialog] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    if (!isOwner) {
        // Non-owners don't manage invites. Render nothing — saves a card from showing.
        return null;
    }

    const generateInviteCode = () => {
        const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        const bytes = new Uint8Array(8);
        crypto.getRandomValues(bytes);
        let out = "";
        for (let i = 0; i < bytes.length; i++) {
            out += ALPHABET[bytes[i] % ALPHABET.length];
        }
        return out;
    };

    const handleGenerateInvite = async () => {
        if (!user) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!inviteEmail || !emailRegex.test(inviteEmail)) {
            toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
            return;
        }
        if (!isUnlocked) {
            toast({ title: "Vault locked", description: "Unlock your vault before inviting members.", variant: "destructive" });
            return;
        }

        setIsGenerating(true);
        const inviteCode = generateInviteCode();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const wrapped = await wrapDEKForInvite(inviteCode);
        if (!wrapped) {
            setIsGenerating(false);
            toast({ title: "Error", description: "Could not prepare encryption key. Try again.", variant: "destructive" });
            return;
        }

        const { error } = await supabase.from("household_invites").insert({
            household_id: householdId,
            invite_code: inviteCode,
            invited_email: inviteEmail,
            created_by: user.id,
            expires_at: expiresAt.toISOString(),
            status: "pending",
            encrypted_dek: wrapped.encryptedDEK,
            dek_iv: wrapped.iv,
            dek_salt: wrapped.salt,
        });

        setIsGenerating(false);
        if (error) {
            toast({ title: "Error", description: "Failed to generate invite", variant: "destructive" });
            return;
        }
        toast({ title: "Invite created", description: `Invite generated for ${inviteEmail}` });
        setShowEmailDialog(false);
        setInviteEmail("");
        onUpdate();
    };

    const handleInviteCoParent = async () => {
        if (!user) return;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(coParentEmail)) {
            toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
            return;
        }
        if (!isUnlocked) {
            toast({ title: "Vault locked", description: "Unlock your vault before inviting.", variant: "destructive" });
            return;
        }

        setIsGenerating(true);
        try {
            const { code } = await inviteNewCoParent({
                householdId,
                userId: user.id,
                invitedEmail: coParentEmail,
                wrapForSelf: wrapKeyForSelf,
                loadKey: (spaceId, dek) => loadScopeKey(spaceScope(spaceId), dek),
                wrapForInvite: wrapSpaceDEKForInvite,
                generateCode: generateSpaceInviteCode,
            });
            setIssuedCode(code);
            refreshCoParents();
            onUpdate();
        } catch (err) {
            toast({
                title: "Invite failed",
                description: err instanceof Error ? err.message : "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const closeCoParentDialog = () => {
        setShowCoParentDialog(false);
        setCoParentEmail("");
        setIssuedCode(null);
    };

    const copyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast({ title: "Copied", description: "Invite code copied to clipboard." });
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleDeleteInvite = async (inviteId: string) => {
        const { error } = await supabase.from("household_invites").delete().eq("id", inviteId);
        if (error) {
            toast({ title: "Error", description: "Failed to delete invite", variant: "destructive" });
            return;
        }
        onUpdate();
    };

    const demoMode = isDemoMode();
    const pendingCoParents = coParents.filter(cp => cp.pendingInvite);
    // Hide expired-unaccepted (already dead) and accepted (already used) rows.
    // The owner only ever sees still-actionable invites.
    const pendingInvites = invites.filter(i => {
        if (i.status === "accepted") return false;
        const isExpired = new Date(i.expires_at) < new Date();
        if (isExpired && i.status === "pending") return false;
        return true;
    });

    return (
        <>
            <SettingsCard
                eyebrow="Invites"
                eyebrowRight={
                    <div className="flex gap-1 -my-1">
                        <Button size="sm" variant="ghost" onClick={() => setShowEmailDialog(true)} disabled={demoMode} className="h-7 px-2 text-accent-dk hover:text-accent-dk hover:bg-accent-tint">
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            Member
                        </Button>
                        {sharedExpensesEnabled && (
                            <Button size="sm" variant="ghost" onClick={() => setShowCoParentDialog(true)} disabled={demoMode} className="h-7 px-2 text-accent-dk hover:text-accent-dk hover:bg-accent-tint">
                                <Baby className="h-3.5 w-3.5 mr-1.5" />
                                Co-parent
                            </Button>
                        )}
                    </div>
                }
                contentClassName={pendingInvites.length === 0 && pendingCoParents.length === 0 ? "p-5" : "p-0"}
            >
                {pendingInvites.length === 0 && pendingCoParents.length === 0 ? (
                    <div className="text-center">
                        <p className="font-semibold text-ink">No pending invites</p>
                        <p className="text-sm text-muted mt-1">Generate one and share it with a user you want to invite to your household.</p>
                        {demoMode && (
                            <p className="text-xs text-muted mt-2">Inviting is disabled in the demo.</p>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-line-2">
                        {pendingInvites.map((invite) => (
                            <div key={invite.id} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex-1 min-w-0 text-sm truncate">
                                    {invite.invited_email && (
                                        <>
                                            <span className="text-ink">{invite.invited_email}</span>
                                            <span className="mx-2 text-muted">·</span>
                                        </>
                                    )}
                                    <span className="text-xs text-muted">expires {format(new Date(invite.expires_at), "PPP")}</span>
                                </div>
                                <code className="font-mono font-semibold text-ink shrink-0">{invite.invite_code}</code>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" onClick={() => copyInviteCode(invite.invite_code)} aria-label="Copy code" className="h-8 w-8">
                                        {copiedCode === invite.invite_code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteInvite(invite.id)} aria-label="Delete invite" className="h-8 w-8 text-muted hover:text-danger">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {pendingCoParents.length > 0 && (
                    <div className="divide-y divide-line-2 border-t border-line-2">
                        {pendingCoParents.map(cp => (
                            <div key={cp.id} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex-1 min-w-0 text-sm truncate">
                                    <span className="text-ink">{cp.pendingInvite?.email}</span>
                                    <span className="mx-2 text-muted">·</span>
                                    <span className="text-xs text-muted">
                                        expires {cp.pendingInvite ? format(new Date(cp.pendingInvite.expiresAt), "PPP") : ""}
                                    </span>
                                </div>
                                <SettingsBadge>Co-parent</SettingsBadge>
                            </div>
                        ))}
                    </div>
                )}
            </SettingsCard>

            <Dialog open={showCoParentDialog} onOpenChange={(o) => { if (!o && !isGenerating) closeCoParentDialog(); }}>
                <DialogContent>
                    {issuedCode ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>Send this code to them</DialogTitle>
                                <DialogDescription>
                                    Only a hash of it is stored, so it cannot be shown again — close this and you would need to issue a new one. Expires in 72 hours.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 font-mono font-semibold text-ink text-center py-3 rounded bg-surface-2 tracking-wider">
                                    {formatSpaceInviteCode(issuedCode)}
                                </code>
                                <Button variant="ghost" size="icon" onClick={() => copyInviteCode(formatSpaceInviteCode(issuedCode))} aria-label="Copy code">
                                    {copiedCode === formatSpaceInviteCode(issuedCode) ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <DialogFooter>
                                <Button onClick={closeCoParentDialog}>Done</Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>Invite a co-parent</DialogTitle>
                                <DialogDescription>
                                    They get a shared kid schedule and only the costs you publish — nothing else in your household. Their name fills in when they accept.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                                <Label htmlFor="coparent-invite-email">Their email address</Label>
                                <Input
                                    id="coparent-invite-email"
                                    type="email"
                                    placeholder={PLACEHOLDERS.EMAIL}
                                    value={coParentEmail}
                                    onChange={(e) => setCoParentEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleInviteCoParent()}
                                    autoFocus
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={closeCoParentDialog} disabled={isGenerating}>Cancel</Button>
                                <Button onClick={handleInviteCoParent} disabled={isGenerating}>
                                    {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create invite"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invite a member</DialogTitle>
                        <DialogDescription>
                            Generates an 8-character code that expires in 24 hours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email address</Label>
                        <Input
                            id="invite-email"
                            type="email"
                            placeholder={PLACEHOLDERS.EMAIL}
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleGenerateInvite()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowEmailDialog(false)} disabled={isGenerating}>Cancel</Button>
                        <Button onClick={handleGenerateInvite} disabled={isGenerating}>
                            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Generate invite"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
