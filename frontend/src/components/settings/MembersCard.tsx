import { Crown, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SettingsCard } from "./SettingsCard";

interface MembersCardProps {
    members: any[];
    userRole: string;
    onUpdate: () => void;
}

export const MembersCard = ({ members, userRole, onUpdate }: MembersCardProps) => {
    const { user } = useAuth();
    const isOwner = userRole === "owner";

    const handleRemove = async (memberId: string, name: string) => {
        if (!confirm(`Remove ${name} from this household?`)) return;
        const { error } = await (supabase as any).rpc("request_member_exit", { member_id_in: memberId });
        if (error) {
            toast.error("Failed to remove member");
            return;
        }
        toast.success(`${name} will see a one-time dialog to take items with them.`);
        onUpdate();
    };

    return (
        <SettingsCard
            eyebrow="Members"
            eyebrowRight={members.length}
            contentClassName="p-0"
        >
            <div className="divide-y divide-line-2">
                {members.map(m => {
                    const isSelf = m.user_id === user?.id;
                    const isOwnerRow = m.role === "owner";
                    const canRemove = isOwner && !isSelf && !isOwnerRow;
                    return (
                        <div key={m.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-ink leading-tight truncate">
                                        {m.profiles?.full_name || "Unnamed"}
                                    </p>
                                    {isOwnerRow && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-tint text-accent-dk">
                                            <Crown className="h-3 w-3" />
                                            Owner
                                        </span>
                                    )}
                                    {isSelf && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                                            You
                                        </span>
                                    )}
                                </div>
                                {m.profiles?.email_public && m.profiles?.email && (
                                    <p className="text-sm text-muted mt-0.5 truncate">{m.profiles.email}</p>
                                )}
                            </div>
                            {canRemove && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemove(m.id, m.profiles?.full_name || "this member")}
                                    aria-label="Remove member"
                                    className="h-8 w-8 shrink-0 text-muted hover:text-danger"
                                >
                                    <UserMinus className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </SettingsCard>
    );
};
