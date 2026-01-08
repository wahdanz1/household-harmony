import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, getFinancialMonthRange } from "@/utils/dateUtils";

interface PageHeaderProps {
    title: string;
    subtitle?: string; // Optional custom subtitle (overrides financial month)
    totalLabel?: string;
    totalAmount?: number;
    totalColorClass?: string; // e.g., "text-success" or "text-destructive"
    showSmartDefaults?: boolean;
    children?: React.ReactNode;
}

/**
 * Reusable page header with financial month display
 * Used consistently across Income, Expenses, and Dashboard pages
 */
export const PageHeader = ({
    title,
    subtitle,
    totalLabel,
    totalAmount,
    totalColorClass = "text-success",
    showSmartDefaults = false,
    children,
}: PageHeaderProps) => {
    const { household, financialMonthStart } = useHousehold();
    const currentMonth = getCurrentFinancialMonth(financialMonthStart);
    const { start: monthStart, end: monthEnd } = getFinancialMonthRange(currentMonth, financialMonthStart);

    // Use custom subtitle or default to financial month range
    const displaySubtitle = subtitle || `${format(monthStart, "MMM d")} – ${format(monthEnd, "MMM d, yyyy")}`;

    return (
        <div className="flex items-center justify-between">
            <div>
                <h1>{title}</h1>
                <div className="flex items-center gap-2 mt-2">
                    <p className="text-muted-foreground">
                        {displaySubtitle}
                    </p>
                    {showSmartDefaults && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                            <Sparkles className="h-3 w-3" />
                            Smart defaults
                        </span>
                    )}
                    {children}
                </div>
            </div>
            {totalLabel && totalAmount !== undefined && (
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">{totalLabel}</p>
                    <p className={`text-2xl sm:text-3xl font-bold ${totalColorClass}`}>
                        {totalAmount.toFixed(0)} {household?.currency || "SEK"}
                    </p>
                </div>
            )}
        </div>
    );
};
