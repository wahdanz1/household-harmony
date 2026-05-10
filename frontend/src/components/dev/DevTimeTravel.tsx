import { useState } from "react";
import { format } from "date-fns";
import { Clock, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNow, getDevToday, setDevToday, isDev } from "@/utils/devTime";
import { useHousehold } from "@/contexts/HouseholdContext";
import { getCurrentFinancialMonth, formatFinancialMonth } from "@/utils/dateUtils";

/**
 * Dev-only floating panel for time travel. Lets you simulate "today"
 * being any past or future date so you can test the Monthly Review flow,
 * carry-forward, future-month planning, etc. without waiting for the
 * real clock.
 *
 * Renders nothing in production builds.
 */
export const DevTimeTravel = () => {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => {
        const stored = getDevToday();
        if (stored) return stored.slice(0, 10);
        return format(new Date(), "yyyy-MM-dd");
    });

    const { financialMonthStart } = useHousehold();
    const current = getDevToday();
    const isOverridden = !!current;

    if (!isDev()) return null;

    const apply = () => {
        if (!draft) return;
        setDevToday(draft);
        // Reload so every component picks up the new "now" cleanly —
        // selectedMonth state, fetchData, hooks all reset together.
        window.location.reload();
    };

    const reset = () => {
        setDevToday(null);
        window.location.reload();
    };

    const effectiveNow = getNow();
    const fm = getCurrentFinancialMonth(financialMonthStart);

    return (
        <div className="hidden sm:block fixed bottom-4 right-4 z-50">
            {open ? (
                <div className="bg-background border-2 border-warning/60 rounded-lg shadow-xl p-4 w-80 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-warning" />
                            <span className="font-semibold text-sm">Dev: Time Travel</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 pb-2 border-b border-border/50">
                        <div>
                            <span className="opacity-70">Effective today:</span>{" "}
                            <span className="font-mono">{format(effectiveNow, "yyyy-MM-dd")}</span>
                            {isOverridden && (
                                <span className="ml-2 text-warning font-medium">(overridden)</span>
                            )}
                        </div>
                        <div>
                            <span className="opacity-70">Financial month:</span>{" "}
                            <span className="font-mono">{formatFinancialMonth(fm, financialMonthStart)}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dev-date" className="text-xs">Set "today" to</Label>
                        <Input
                            id="dev-date"
                            type="date"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={apply} size="sm" className="flex-1">
                            Apply &amp; reload
                        </Button>
                        {isOverridden && (
                            <Button onClick={reset} size="sm" variant="outline">
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Reset
                            </Button>
                        )}
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-tight">
                        Affects "current financial month" calculations only. Database
                        timestamps (accepted_at, created_at) still use the real clock.
                    </p>
                </div>
            ) : (
                <Button
                    onClick={() => setOpen(true)}
                    size="icon"
                    variant="outline"
                    className={`h-10 w-10 rounded-full shadow-lg ${isOverridden ? "border-warning bg-warning/10" : ""}`}
                    title={isOverridden ? `Time travel active: ${current}` : "Open time travel"}
                >
                    <Clock className={`h-4 w-4 ${isOverridden ? "text-warning" : ""}`} />
                </Button>
            )}
        </div>
    );
};
