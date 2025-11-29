import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Info, ExternalLink, CreditCard, Shield, Check } from "lucide-react";
import { useState } from "react";

interface ExpenseSummaryBlocksProps {
    subscriptionsTotal: number;
    insuranceTotal: number;
    currency: string;
    hasSubscriptionsEntry?: boolean;
    hasInsuranceEntry?: boolean;
    onNavigateToSubscriptions?: () => void;
    onNavigateToInsurance?: () => void;
}

export const ExpenseSummaryBlocks = ({
    subscriptionsTotal,
    insuranceTotal,
    currency,
    hasSubscriptionsEntry = false,
    hasInsuranceEntry = false,
    onNavigateToSubscriptions,
    onNavigateToInsurance,
}: ExpenseSummaryBlocksProps) => {
    const [showSubscriptionsTooltip, setShowSubscriptionsTooltip] = useState(false);
    const [showInsuranceTooltip, setShowInsuranceTooltip] = useState(false);

    return (
        <>
            {subscriptionsTotal > 0 && (
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-muted/40">
                    {/* Mobile */}
                    <div className="sm:hidden space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium text-muted-foreground">Subscriptions</p>
                                <TooltipProvider>
                                    <Tooltip open={showSubscriptionsTooltip}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 p-0"
                                                onClick={() => setShowSubscriptionsTooltip(!showSubscriptionsTooltip)}
                                            >
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This amount is calculated from your active subscriptions</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {hasSubscriptionsEntry && <Check className="h-4 w-4 text-success" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={subscriptionsTotal.toFixed(0)}
                                disabled
                                className="flex-1 text-right text-lg font-semibold bg-transparent border-0 border-b-2 border-border rounded-none px-2 py-1 opacity-50 cursor-not-allowed"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                        </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="font-medium text-muted-foreground truncate">Subscriptions</p>
                                <TooltipProvider>
                                    <Tooltip open={showSubscriptionsTooltip}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 p-0"
                                                onClick={() => setShowSubscriptionsTooltip(!showSubscriptionsTooltip)}
                                            >
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This amount is calculated from your active subscriptions</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {hasSubscriptionsEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={subscriptionsTotal.toFixed(0)}
                                disabled
                                className="w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 border-border rounded-none px-2 py-1 opacity-50 cursor-not-allowed"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            {onNavigateToSubscriptions && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onNavigateToSubscriptions}
                                    className="h-9 w-9"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {insuranceTotal > 0 && (
                <div className="p-3 sm:p-4 rounded-lg border border-border bg-muted/40">
                    {/* Mobile */}
                    <div className="sm:hidden space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <p className="font-medium text-muted-foreground">Monthly Insurance Cost</p>
                                <TooltipProvider>
                                    <Tooltip open={showInsuranceTooltip}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 p-0"
                                                onClick={() => setShowInsuranceTooltip(!showInsuranceTooltip)}
                                            >
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This amount is calculated from your insurance policies</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {hasInsuranceEntry && <Check className="h-4 w-4 text-success" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={insuranceTotal.toFixed(0)}
                                disabled
                                className="flex-1 text-right text-lg font-semibold bg-transparent border-0 border-b-2 border-border rounded-none px-2 py-1 opacity-50 cursor-not-allowed"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                        </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden sm:flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="font-medium text-muted-foreground truncate">Monthly Insurance Cost</p>
                                <TooltipProvider>
                                    <Tooltip open={showInsuranceTooltip}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-5 w-5 p-0"
                                                onClick={() => setShowInsuranceTooltip(!showInsuranceTooltip)}
                                            >
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>This amount is calculated from your insurance policies</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {hasInsuranceEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={insuranceTotal.toFixed(0)}
                                disabled
                                className="w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 border-border rounded-none px-2 py-1 opacity-50 cursor-not-allowed"
                            />
                            <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            {onNavigateToInsurance && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onNavigateToInsurance}
                                    className="h-9 w-9"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
