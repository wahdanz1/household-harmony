import { useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Alert, AlertContent, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOutageStatus } from "@/hooks/useOutageStatus";
import { retry } from "@/utils/outageMonitor";

/**
 * Sticky banner shown when the outage monitor is tripped. Renders
 * exactly one notification — replaces the spam of failed-request toasts
 * during a real backend outage.
 */
export const OutageBanner = () => {
    const status = useOutageStatus();
    const [retrying, setRetrying] = useState(false);

    if (status !== "down") return null;

    const handleRetry = async () => {
        setRetrying(true);
        try {
            await retry();
        } finally {
            setRetrying(false);
        }
    };

    return (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-1.5rem)]">
            <Alert variant="destructive" className="bg-destructive/10 backdrop-blur-sm shadow-lg">
                <AlertTriangle />
                <AlertContent>
                    <AlertTitle>Can't reach the server right now.</AlertTitle>
                    <AlertDescription>
                        We've paused background syncing to avoid hammering. Retry when you think it's back.
                    </AlertDescription>
                </AlertContent>
                <Button onClick={handleRetry} disabled={retrying} size="sm" variant="outline" className="shrink-0">
                    <RotateCw className={`h-3.5 w-3.5 mr-1 ${retrying ? "animate-spin" : ""}`} />
                    {retrying ? "Checking..." : "Retry"}
                </Button>
            </Alert>
        </div>
    );
};
