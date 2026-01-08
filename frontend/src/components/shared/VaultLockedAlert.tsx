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
                <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
                    <AlertTriangle className="h-6 w-6 stroke-amber-500" />
                </div>
                <div>
                    <AlertTitle className="text-lg font-semibold mb-1">Vault Locked</AlertTitle>
                    <AlertDescription className="text-base text-amber-500/90">
                        {description}
                    </AlertDescription>
                </div>
            </div>

            <VaultUnlockButton
                variant="outline"
                className="h-10 px-6 ml-4 border-amber-500/50 hover:bg-amber-500/20 hover:text-amber-500 text-base font-medium whitespace-nowrap"
            />
        </Alert>
    );
};
