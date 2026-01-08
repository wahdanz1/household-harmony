import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type ColorVariant = 'green' | 'red' | 'purple' | 'amber' | 'default';

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
    green: 'text-green-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
    amber: 'text-amber-500',
    default: 'text-foreground',
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
    const amountColor = color === 'green' || color === 'red' ? colorClasses[color] : 'text-foreground';

    return (
        <Card
            className="hover:bg-muted/60 cursor-pointer transition-colors"
            onClick={onClick}
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <span className="text-xs text-muted-foreground">{title}</span>
            </div>
            <p className={`text-xl font-bold ${amountColor}`}>
                {amount} {currency}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
        </Card>
    );
};
