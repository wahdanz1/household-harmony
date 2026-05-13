import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, ArrowRight, Calculator } from "lucide-react";
import { formatSEK, getTaxStatusColor } from "@/services/tax";

interface TaxSummaryCardProps {
    grossIncome: number;
    estimatedTax: number;
    netIncome: number;
    effectiveRate?: number;
    onViewPrognosis?: () => void;
    loading?: boolean;
}

export const TaxSummaryCard = ({
    grossIncome,
    estimatedTax,
    netIncome,
    effectiveRate,
    onViewPrognosis,
    loading = false,
}: TaxSummaryCardProps) => {
    if (loading) {
        return (
            <Card className="bg-surface-2/30">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-center py-4">
                        <p className="text-muted text-sm">Calculating tax...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-r from-surface-2/30 to-surface-2/10 border-muted/20">
            <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                    {/* Tax Breakdown */}
                    <div className="grid-3 text-center">
                        <div>
                            <p className="text-xs text-muted uppercase tracking-wide">Gross</p>
                            <p className="text-lg font-bold text-accent">{formatSEK(grossIncome)}</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="text-xs text-muted uppercase tracking-wide">Tax</p>
                            <div className="flex items-center gap-1">
                                <TrendingDown className="h-4 w-4 text-danger" />
                                <p className="text-lg font-bold text-danger">{formatSEK(estimatedTax)}</p>
                            </div>
                            {effectiveRate !== undefined && (
                                <p className="text-xs text-muted">({effectiveRate.toFixed(1)}%)</p>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-muted uppercase tracking-wide">Net</p>
                            <p className="text-lg font-bold">{formatSEK(netIncome)}</p>
                        </div>
                    </div>

                    {/* Tax Flow Arrow */}
                    <div className="flex items-center justify-center gap-2 text-muted">
                        <span className="text-sm">Gross</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="text-sm">- Tax</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="text-sm font-medium">Net Income</span>
                    </div>

                    {/* View Prognosis Button */}
                    {onViewPrognosis && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onViewPrognosis}
                            className="w-full"
                        >
                            <Calculator className="h-4 w-4 mr-2" />
                            View Annual Tax Prognosis
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
