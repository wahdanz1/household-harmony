import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { HouseholdPreviewCard, type PreviewMember } from "@/components/shared/HouseholdPreviewCard";

// Re-export so existing imports of PreviewMember from this module keep working.
export type { PreviewMember };

interface JoinStepPreviewProps {
    householdName: string;
    members: PreviewMember[];
    onBack: () => void;
    onContinue: () => void;
}

export const JoinStepPreview = ({ householdName, members, onBack, onContinue }: JoinStepPreviewProps) => (
    <>
        <DialogHeader>
            <DialogTitle>{householdName}</DialogTitle>
            <DialogDescription>You're about to join this household.</DialogDescription>
        </DialogHeader>
        <HouseholdPreviewCard members={members} />
        <DialogFooter className="sm:justify-between">
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
