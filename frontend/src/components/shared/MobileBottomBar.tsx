import { ReactNode } from "react";

interface MobileBottomBarProps {
    children: ReactNode;
}

export const MobileBottomBar = ({ children }: MobileBottomBarProps) => (
    <div
        className="fixed inset-x-0 z-30 sm:hidden pointer-events-none"
        style={{ bottom: "calc(58px + env(safe-area-inset-bottom))" }}
    >
        <div className="h-8 bg-gradient-to-t from-background to-transparent" aria-hidden />
        <div
            className="px-4 pt-2 pb-3 pointer-events-auto"
            style={{
                background: "var(--bg-trans)",
                backdropFilter: "blur(18px) saturate(160%)",
                WebkitBackdropFilter: "blur(18px) saturate(160%)",
            }}
        >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                {children}
            </div>
        </div>
    </div>
);

export const mobileBottomBarSpacer = "pb-[120px] sm:pb-0";
