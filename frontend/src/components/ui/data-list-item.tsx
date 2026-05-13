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
                "list-row-compact sm:p-4 transition-colors",
                onClick && "cursor-pointer hover:bg-bg/60",
                className
            )}
        >
            {children}
        </div>
    );
};
