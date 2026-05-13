import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Alert — natural flex layout, vertically centered.
 *
 * Usage:
 *   <Alert variant="warning">
 *     <Icon />
 *     <AlertContent>
 *       <AlertTitle>...</AlertTitle>
 *       <AlertDescription>...</AlertDescription>
 *     </AlertContent>
 *     <Button>Action</Button>
 *   </Alert>
 *
 * Children flow horizontally, vertically centered. AlertContent is the
 * flex-1 wrapper for the title + description block. Override layout via
 * className on Alert (e.g. items-start for tall multi-line bodies).
 */
const alertVariants = cva(
  "relative w-full rounded-lg border p-4 md:p-5 flex items-start gap-3 [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:mt-0.5",
  {
    variants: {
      variant: {
        default: "bg-bg text-ink border-line",
        destructive: "border-danger/50 bg-danger/10 text-danger [&>svg]:text-danger",
        warning: "border-warn/50 bg-warn/10 text-warn [&>svg]:text-warn",
        success: "border-accent/50 bg-accent/10 text-accent [&>svg]:text-accent",
        info: "border-accent/50 bg-accent/10 text-accent [&>svg]:text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

/**
 * Wrapper for the title + description block inside an Alert. Takes flex-1
 * so the icon stays compact and any trailing action button hugs the right.
 */
const AlertContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 min-w-0", className)} {...props} />
  ),
);
AlertContent.displayName = "AlertContent";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-tight tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertContent, AlertTitle, AlertDescription };
