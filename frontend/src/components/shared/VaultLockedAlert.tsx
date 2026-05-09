import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { VaultUnlockButton } from "@/components/shared/VaultUnlockDialog";

interface VaultLockedAlertProps {
    description?: string;
    className?: string;
}

export const VaultLockedAlert = ({
    description = "Your vault is locked. Please unlock it to view and manage sensitive data.",
    className,
}: VaultLockedAlertProps) => {
    return (
        <Alert variant="warning" className={cn("[&>svg]:size-6", className)}>
            <AlertTriangle />
            <AlertContent>
                <AlertTitle className="text-base">Vault Locked</AlertTitle>
                <AlertDescription>{description}</AlertDescription>
            </AlertContent>
            <VaultUnlockButton
                variant="outline"
                className="shrink-0 border-warning/50 hover:bg-warning/20 hover:text-warning"
            />
        </Alert>
    );
};
