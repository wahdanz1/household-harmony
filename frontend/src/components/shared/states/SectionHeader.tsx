import { ReactNode } from "react";

interface SectionHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export const SectionHeader = ({ title, description, action, className = "" }: SectionHeaderProps) => {
    return (
        <div className={`section-header ${className}`}>
            <div>
                <h3>{title}</h3>
                {description && <p className="text-subtitle">{description}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
};
