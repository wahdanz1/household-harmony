import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CatIcon } from "./cat-icon";
import { matchBrandIcon } from "@/constants/brandIcons";

interface ServiceIconProps {
    /** Service / brand name to look up in the brand registry. */
    serviceName?: string | null;
    /** Fallback icon when no brand match (the category icon). */
    fallbackIcon: LucideIcon;
    /** Hue for the fallback CatIcon. */
    fallbackHue?: number;
    size?: number;
    className?: string;
}

export const ServiceIcon = ({
    serviceName, fallbackIcon, fallbackHue, size = 36, className,
}: ServiceIconProps) => {
    const brand = matchBrandIcon(serviceName);

    if (!brand) {
        return <CatIcon icon={fallbackIcon} hue={fallbackHue} size={size} className={className} />;
    }

    const { Icon, hex } = brand;
    return (
        <div
            className={cn("flex items-center justify-center shrink-0", className)}
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.32),
                background: hex,
            }}
        >
            <Icon size={Math.round(size * 0.5)} color="#ffffff" />
        </div>
    );
};
