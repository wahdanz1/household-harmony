import { cn } from "@/lib/utils";

interface DataListItemProps {
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
}

export const DataListItem = ({ onClick, className, children }: DataListItemProps) => {
    return (
        <div
            onClick={onClick}
            className={cn(
                "p-3 sm:p-4 rounded-lg border border-border bg-background/40 transition-colors",
                onClick && "cursor-pointer hover:bg-background/60",
                className
            )}
        >
            {children}
        </div>
    );
};
