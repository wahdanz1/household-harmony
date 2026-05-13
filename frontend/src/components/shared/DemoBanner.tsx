import { useState } from "react";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, MessageCircle } from "lucide-react";
import { isDemoMode as checkDemoMode } from "@/utils/demoMode";

export const DemoBanner = () => {
    const [dismissed, setDismissed] = useState(
        localStorage.getItem('demo_banner_dismissed') === 'true'
    );

    const isDemoMode = checkDemoMode();

    if (!isDemoMode || dismissed) return null;

    const handleDismiss = () => {
        localStorage.setItem('demo_banner_dismissed', 'true');
        setDismissed(true);
    };

    return (
        <Alert variant="warning" className="mb-4">
            <AlertCircle />
            <AlertContent>
                <AlertTitle>Demo Mode</AlertTitle>
                <AlertDescription>
                    You're exploring with sample data. All features work, including encryption, but data resets after 24h.
                </AlertDescription>
            </AlertContent>
            <div className="flex gap-2 shrink-0">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="default">
                                Create Real Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Request Account Access</DialogTitle>
                                <DialogDescription>
                                    Household Harmony is currently in controlled beta. Contact me to get your email whitelisted for a permanent account:
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center gap-3">
                                    <MessageCircle className="h-5 w-5 text-accent" />
                                    <div>
                                        <p className="text-sm font-medium">Discord</p>
                                        <a
                                            href="https://discord.com/users/wahdanz#5803"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-accent hover:underline"
                                        >
                                            wahdanz#5803
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-accent" />
                                    <div>
                                        <p className="text-sm font-medium">LinkedIn</p>
                                        <a
                                            href="https://www.linkedin.com/in/dwahlgren/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-accent hover:underline"
                                        >
                                            linkedin.com/in/dwahlgren
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDismiss}
                    >
                        <X className="h-4 w-4" />
                    </Button>
            </div>
        </Alert>
    );
};
