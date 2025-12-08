import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface AutoFillButtonProps {
    onAutoFill: () => Promise<void>;
    loading?: boolean;
    disabled?: boolean;
    tooltip?: string;
}

export const AutoFillButton = ({
    onAutoFill,
    loading = false,
    disabled = false,
    tooltip = "Auto-fill from historical data",
}: AutoFillButtonProps) => {
    const handleClick = async () => {
        if (!loading && !disabled) {
            await onAutoFill();
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClick}
                        disabled={loading || disabled}
                        className="gap-2"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Auto-fill</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
