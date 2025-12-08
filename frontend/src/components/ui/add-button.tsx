import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { forwardRef } from "react";

interface AddButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

/**
 * Consistent "Add" button used throughout the app.
 * Uses primary styling with Plus icon for adding new items.
 */
export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <Button ref={ref} className={className} {...props}>
                <Plus className="h-4 w-4 mr-2" />
                {children}
            </Button>
        );
    }
);

AddButton.displayName = "AddButton";
