import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type ColorVariant = 'success' | 'destructive' | 'accent-purple' | 'warning' | 'default';

interface SummaryCardProps {
    title: string;
    icon: LucideIcon;
    amount: string;
    periodLabel: string;
    color?: ColorVariant;
    onClick?: () => void;
    currency?: string;
}

const colorClasses: Record<ColorVariant, string> = {
    success: 'text-accent',
    destructive: 'text-danger',
    'accent-purple': 'text-accent',
    warning: 'text-warn',
    default: 'text-ink',
};

export const SummaryCard = ({
    title,
    icon: Icon,
    amount,
    periodLabel,
    color = 'default',
    onClick,
    currency = 'SEK',
}: SummaryCardProps) => {
    const iconColor = colorClasses[color];
    const amountColor = color === 'success' || color === 'destructive' ? colorClasses[color] : 'text-ink';

    return (
        <Card
            className="hover:bg-surface-2/60 cursor-pointer transition-colors"
            onClick={onClick}
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <span className="text-xs text-muted">{title}</span>
            </div>
            <p className={`text-xl font-bold ${amountColor}`}>
                {amount} {currency}
            </p>
            <p className="text-xs text-muted mt-1">{periodLabel}</p>
        </Card>
    );
};
