import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { PLACEHOLDERS } from "@/constants/ui";

interface JoinStepSignupProps {
    householdName: string;
    fullName: string;
    setFullName: (v: string) => void;
    email: string;
    setEmail: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    confirmPassword: string;
    setConfirmPassword: (v: string) => void;
    loading: boolean;
    onBack: () => void;
    onSignUp: () => void;
}

export const JoinStepSignup = ({
    householdName, fullName, setFullName, email, setEmail,
    password, setPassword, confirmPassword, setConfirmPassword,
    loading, onBack, onSignUp,
}: JoinStepSignupProps) => (
    <>
        <DialogHeader>
            <DialogTitle>Create Your Account</DialogTitle>
            <DialogDescription>
                You'll join {householdName} after creating your account
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
                    placeholder={PLACEHOLDERS.EMAIL}
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
            <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <Button onClick={onSignUp} disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Join"}
            </Button>
        </DialogFooter>
    </>
);
