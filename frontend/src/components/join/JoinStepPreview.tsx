import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Users, ArrowRight, ArrowLeft } from "lucide-react";

export interface PreviewMember {
    id: string;
    role: string;
    profiles?: { full_name?: string | null; avatar_url?: string | null };
}

interface JoinStepPreviewProps {
    householdName: string;
    members: PreviewMember[];
    onBack: () => void;
    onContinue: () => void;
}

export const JoinStepPreview = ({ householdName, members, onBack, onContinue }: JoinStepPreviewProps) => (
    <>
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {householdName}
            </DialogTitle>
            <DialogDescription>
                You're about to join this household
            </DialogDescription>
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
                            {member.role === "owner" && (
                                <Check className="h-4 w-4 text-accent" />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <Button onClick={onContinue}>
                Continue to Sign Up
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </DialogFooter>
    </>
);
