import { ClipboardCheck, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ReviewBannerProps {
    /** Opens the Monthly Review wizard. */
    onOpen: () => void;
}

/**
 * Shared "review pending" CTA shown on Overview / Income / Expenses when the
 * current financial month hasn't been finalized. Single look + copy + action
 * everywhere; each page mounts its own MonthlyReviewWizard and passes onOpen.
 */
export const ReviewBanner = ({ onOpen }: ReviewBannerProps) => (
    <Card
        variant="cta"
        className="flex items-center justify-between"
        onClick={onOpen}
    >
        <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-accent-dk" />
            <div>
                <p className="font-medium text-sm text-accent-dk">New month! Review your finances</p>
                <p className="text-xs text-accent-dk/70">Confirm your income and expenses are up to date</p>
            </div>
        </div>
        <ChevronRight className="h-5 w-5 text-accent-dk" />
    </Card>
);
