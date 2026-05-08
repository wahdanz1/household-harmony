import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatSEK, getTaxStatusColor } from "@/services/tax";
import type { TaxPrognosisResult } from "@/types/api";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";

interface TaxPrognosisModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prognosis: TaxPrognosisResult | null;
    loading?: boolean;
}

export const TaxPrognosisModal = ({
    open,
    onOpenChange,
    prognosis,
    loading = false,
}: TaxPrognosisModalProps) => {
    if (!prognosis && !loading) return null;

    const StatusIcon = prognosis?.status === 'owing' ? AlertCircle : CheckCircle;
    const statusColorClass = prognosis?.status === 'owing'
        ? 'text-destructive bg-destructive/10 border-destructive/20'
        : 'text-success bg-success/10 border-success/20';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Annual Tax Prognosis
                    </DialogTitle>
                    <DialogDescription>
                        Based on your current income and deductions
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-muted-foreground">Calculating prognosis...</p>
                    </div>
                ) : prognosis ? (
                    <div className="space-y-6 py-4">
                        {/* Status Banner */}
                        <div className={`rounded-lg border p-4 ${statusColorClass}`}>
                            <div className="flex items-center gap-3">
                                <StatusIcon className="h-6 w-6" />
                                <div>
                                    <p className="font-semibold text-lg">
                                        {prognosis.status === 'owing' ? 'You will likely owe' : 'You will likely receive'}
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {formatSEK(Math.abs(prognosis.prognosis))}
                                    </p>
                                </div>
                            </div>
                            {prognosis.message && (
                                <p className="mt-2 text-sm opacity-80">{prognosis.message}</p>
                            )}
                        </div>

                        {/* Breakdown */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Total Gross Annual Income</span>
                                <span className="font-medium">{formatSEK(prognosis.total_gross_annual)}</span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Expected Annual Tax</span>
                                <span className="font-medium text-destructive">
                                    -{formatSEK(prognosis.expected_annual_tax)}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Tax Already Deducted</span>
                                <span className="font-medium text-muted-foreground">
                                    -{formatSEK(prognosis.actual_tax_deducted)}
                                </span>
                            </div>

                            <div className={`flex justify-between items-center py-2 font-bold ${getTaxStatusColor(prognosis.status)}`}>
                                <span>{prognosis.status === 'owing' ? 'Remaining to Pay' : 'Refund Expected'}</span>
                                <span>{formatSEK(Math.abs(prognosis.prognosis))}</span>
                            </div>
                        </div>

                        {/* Info Note */}
                        <p className="text-xs text-muted-foreground text-center">
                            This is an estimate based on Swedish tax brackets (2025).
                            Actual tax may vary based on deductions and other factors.
                        </p>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};
