import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface JoinStepCodeProps {
    inviteCode: string;
    setInviteCode: (v: string) => void;
    loading: boolean;
    onCancel: () => void;
    onContinue: () => void;
}

export const JoinStepCode = ({ inviteCode, setInviteCode, loading, onCancel, onContinue }: JoinStepCodeProps) => (
    <>
        <DialogHeader>
            <DialogTitle>Join Existing Household</DialogTitle>
            <DialogDescription>
                Enter the 8-character invite code you received
            </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                    id="invite-code"
                    placeholder="ABCD2345"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="text-center text-2xl font-mono tracking-widest"
                />
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
                Cancel
            </Button>
            <Button onClick={onContinue} disabled={loading || inviteCode.length !== 8}>
                {loading ? "Validating..." : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </DialogFooter>
    </>
);
