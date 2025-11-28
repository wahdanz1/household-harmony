import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Check, Users, ArrowRight, ArrowLeft } from "lucide-react";

interface JoinHouseholdWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const JoinHouseholdWizard = ({ open, onOpenChange }: JoinHouseholdWizardProps) => {
    const { signUpAndJoinHousehold } = useAuth();
    const { toast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Invite code
    const [inviteCode, setInviteCode] = useState("");

    // Step 2: Household preview
    const [household, setHousehold] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);

    // Step 3: Sign up form
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const resetWizard = () => {
        setStep(1);
        setInviteCode("");
        setHousehold(null);
        setMembers([]);
        setFullName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
    };

    const handleValidateCode = async () => {
        if (!inviteCode || inviteCode.length !== 6) {
            toast({
                title: "Invalid Code",
                description: "Please enter a valid 6-digit invite code",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        // Fetch invite and household info
        const { data: invite, error: inviteError } = await supabase
            .from("household_invites")
            .select("*, households(*)")
            .eq("invite_code", inviteCode.toUpperCase())
            .eq("is_active", true)
            .single();

        if (inviteError || !invite) {
            toast({
                title: "Invalid Code",
                description: "This invite code is invalid or has expired",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        // Fetch household members
        const { data: membersData } = await supabase
            .from("household_members")
            .select("*, profiles(full_name, avatar_url)")
            .eq("household_id", invite.household_id);

        // Store household with invited_email from invite
        setHousehold({ ...invite.households, invited_email: invite.invited_email });
        setMembers(membersData || []);

        // Pre-fill email if invite is email-locked
        if (invite.invited_email) {
            setEmail(invite.invited_email);
        }

        setStep(2);
        setLoading(false);
    };

    const handleSignUp = async () => {
        if (!fullName || !email || !password) {
            toast({
                title: "Missing Information",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        // Validate email matches invite if invite is email-locked
        if (household?.invited_email && email.toLowerCase() !== household.invited_email.toLowerCase()) {
            toast({
                title: "Email Mismatch",
                description: `This invite is for ${household.invited_email}. Please use the correct email address.`,
                variant: "destructive",
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: "Password Mismatch",
                description: "Passwords do not match",
                variant: "destructive",
            });
            return;
        }

        if (password.length < 6) {
            toast({
                title: "Weak Password",
                description: "Password must be at least 6 characters",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        const { error } = await signUpAndJoinHousehold(email, password, fullName, household.id);

        if (error) {
            toast({
                title: "Sign Up Failed",
                description: error.message || "Failed to create account",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        toast({
            title: "Account Created!",
            description: `You've joined ${household.name}! Please check your email to confirm your account before logging in.`,
        });

        resetWizard();
        onOpenChange(false);
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={(open) => {
            onOpenChange(open);
            if (!open) resetWizard();
        }}>
            <DialogContent className="sm:max-w-[500px]">
                {step === 1 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Join Existing Household</DialogTitle>
                            <DialogDescription>
                                Enter the 6-digit invite code you received
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="invite-code">Invite Code</Label>
                                <Input
                                    id="invite-code"
                                    placeholder="ABC123"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="text-center text-2xl font-mono tracking-widest"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleValidateCode} disabled={loading || inviteCode.length !== 6}>
                                {loading ? "Validating..." : "Continue"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 2 && household && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {household.name}
                            </DialogTitle>
                            <DialogDescription>
                                You're about to join this household
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <h4 className="text-sm font-semibold mb-3">Current Members ({members.length})</h4>
                                <div className="space-y-2">
                                    {members.map((member) => (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg border">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={member.profiles?.avatar_url} />
                                                <AvatarFallback>
                                                    {member.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-medium">{member.profiles?.full_name || "Unknown"}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                                            </div>
                                            {member.role === "owner" && (
                                                <Check className="h-4 w-4 text-success" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={() => setStep(3)}>
                                Continue to Sign Up
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {step === 3 && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Create Your Account</DialogTitle>
                            <DialogDescription>
                                You'll join {household?.name} after creating your account
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(2)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleSignUp} disabled={loading}>
                                {loading ? "Creating Account..." : "Create Account & Join"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
