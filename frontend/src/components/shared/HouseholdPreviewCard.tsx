import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Users } from "lucide-react";

export interface PreviewMember {
    id: string;
    role: string;
    profiles?: { full_name?: string | null; avatar_url?: string | null };
}

interface HouseholdPreviewCardProps {
    householdName: string;
    members: PreviewMember[];
    description: string;
}

/**
 * Shared preview shown in both join flows (JoinStepPreview for new users
 * coming through /auth, JoinExistingUserDialog for users already signed in).
 * Renders the DialogHeader + the "Current members" list. Callers own the
 * surrounding DialogFooter so their button labels + handlers stay distinct.
 */
export const HouseholdPreviewCard = ({
    householdName,
    members,
    description,
}: HouseholdPreviewCardProps) => (
    <>
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {householdName}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div>
                <h4 className="text-sm mb-3">Current Members ({members.length})</h4>
                <div className="space-y-2">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={member.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback>
                                    {member.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                                <p className="text-xs text-muted capitalize">{member.role}</p>
                            </div>
                            {member.role === "owner" && <Check className="h-4 w-4 text-accent" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </>
);
