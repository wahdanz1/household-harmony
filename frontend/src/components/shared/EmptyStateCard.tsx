import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon, Plus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateCardProps {
    icon: LucideIcon;
    iconClassName?: string;
    headline: string;
    description: ReactNode;
    primaryLabel: string;
    onPrimary: () => void;
    /** Hide the secondary "open setup wizard" link (e.g. when already inside the wizard). */
    hideWizardLink?: boolean;
}

export const EmptyStateCard = ({
    icon: Icon,
    iconClassName = "text-accent",
    headline,
    description,
    primaryLabel,
    onPrimary,
    hideWizardLink = false,
}: EmptyStateCardProps) => (
    <Card>
        <div className="flex flex-col items-center text-center gap-4 px-6 py-10">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                <Icon className={`h-6 w-6 ${iconClassName}`} />
            </div>
            <div className="space-y-1.5 max-w-sm">
                <h3 className="text-lg font-semibold">{headline}</h3>
                <p className="text-sm text-muted">{description}</p>
            </div>
            <Button onClick={onPrimary} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                {primaryLabel}
            </Button>
            {!hideWizardLink && (
                <Link
                    to="/?setup=1"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dk hover:underline focus:outline-none focus-visible:underline"
                >
                    <Sparkles className="h-3 w-3" />
                    Or add several at once with the setup wizard
                </Link>
            )}
        </div>
    </Card>
);
