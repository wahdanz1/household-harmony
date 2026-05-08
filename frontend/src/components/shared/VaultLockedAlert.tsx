import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { VaultUnlockButton } from "@/components/shared/VaultUnlockDialog";

interface VaultLockedAlertProps {
    description?: string;
    className?: string;
}

export const VaultLockedAlert = ({
    description = "Your vault is locked. Please unlock it to view and manage sensitive data.",
    className
}: VaultLockedAlertProps) => {
    return (
        <Alert variant="warning" className={`flex items-center justify-between p-4 ${className}`}>
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-warning/10 shrink-0">
                    <AlertTriangle className="h-6 w-6 stroke-warning" />
                </div>
                <div>
                    <AlertTitle className="text-lg font-semibold mb-1">Vault Locked</AlertTitle>
                    <AlertDescription className="text-base text-warning/90">
                        {description}
                    </AlertDescription>
                </div>
            </div>

            <VaultUnlockButton
                variant="outline"
                className="h-10 px-6 ml-4 border-warning/50 hover:bg-warning/20 hover:text-warning text-base font-medium whitespace-nowrap"
            />
        </Alert>
    );
};
