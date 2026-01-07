import { ReactNode } from "react";

interface CardBlockProps {
    children: ReactNode;
    interactive?: boolean;
    onClick?: () => void;
    className?: string;
}

export const CardBlock = ({ children, interactive = false, onClick, className = "" }: CardBlockProps) => {
    const baseClass = interactive ? "card-block-interactive" : "card-block";

    return (
        <div
            className={`${baseClass} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
