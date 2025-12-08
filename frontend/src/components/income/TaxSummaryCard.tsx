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
            <Card className="bg-muted/30">
                <CardContent className="pt-4">
                    <div className="flex items-center justify-center py-4">
                        <p className="text-muted-foreground text-sm">Calculating tax...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-r from-muted/30 to-muted/10 border-muted-foreground/20">
            <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                    {/* Tax Breakdown */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Gross</p>
                            <p className="text-lg font-bold text-success">{formatSEK(grossIncome)}</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Tax</p>
                            <div className="flex items-center gap-1">
                                <TrendingDown className="h-4 w-4 text-destructive" />
                                <p className="text-lg font-bold text-destructive">{formatSEK(estimatedTax)}</p>
                            </div>
                            {effectiveRate !== undefined && (
                                <p className="text-xs text-muted-foreground">({effectiveRate.toFixed(1)}%)</p>
                            )}
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">Net</p>
                            <p className="text-lg font-bold">{formatSEK(netIncome)}</p>
                        </div>
                    </div>

                    {/* Tax Flow Arrow */}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
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
