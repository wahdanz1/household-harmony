import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => {
    return (
        <div className="empty-state">
            <Icon className="empty-state-icon" />
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm mt-2">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
};
