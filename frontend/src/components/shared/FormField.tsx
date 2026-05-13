import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
    label: ReactNode;
    optional?: boolean;
    optionalNote?: string;
    htmlFor?: string;
    className?: string;
    children: ReactNode;
}

export const FormField = ({
    label, optional = false, optionalNote, htmlFor, className, children,
}: FormFieldProps) => (
    <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={htmlFor}>
            {label}
            {optional ? (
                <span className="text-xs text-muted font-normal ml-1">
                    ({optionalNote ?? "optional"})
                </span>
            ) : (
                <span className="text-danger ml-0.5" aria-hidden="true">*</span>
            )}
        </Label>
        {children}
    </div>
);

interface FormRowProps {
    cols?: 1 | 2;
    children: ReactNode;
    className?: string;
}

export const FormRow = ({ cols = 2, children, className }: FormRowProps) => (
    <div
        className={cn(
            cols === 2 ? "grid grid-cols-2 gap-3" : "space-y-3",
            className,
        )}
    >
        {children}
    </div>
);
