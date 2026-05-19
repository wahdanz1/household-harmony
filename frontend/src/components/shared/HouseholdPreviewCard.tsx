import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check } from "lucide-react";

export interface PreviewMember {
    id: string;
    role: string;
    profiles?: { full_name?: string | null; avatar_url?: string | null };
}

interface HouseholdPreviewCardProps {
    members: PreviewMember[];
}

export const HouseholdPreviewCard = ({ members }: HouseholdPreviewCardProps) => (
    <div className="py-4">
        <h4 className="text-sm mb-3">Current Members ({members.length})</h4>
        <div className="divide-y divide-line-2 border-y border-line-2">
            {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={member.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback>
                            {member.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 leading-tight">
                        <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted capitalize">{member.role}</p>
                    </div>
                    {member.role === "owner" && <Check className="h-4 w-4 text-accent" />}
                </div>
            ))}
        </div>
    </div>
);
