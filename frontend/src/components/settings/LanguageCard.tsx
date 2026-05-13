import { Card, CardHeader } from "@/components/ui/card";
import { Languages } from "lucide-react";

/**
 * Language card. The app is currently English-only; the i18n scaffolding
 * supports Swedish but UI strings aren't translated yet. Renders as
 * "English · Active" with a soft "More languages coming soon" sub-line.
 */
export const LanguageCard = () => (
    <Card>
        <CardHeader>
            <div className="flex items-center gap-3">
                <div className="shrink-0 text-muted">
                    <Languages className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink leading-none tracking-tight">English (en-US)</h3>
                        <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-accent-tint text-accent-dk uppercase">
                            Active
                        </span>
                    </div>
                    <p className="text-sm text-muted">More languages coming soon</p>
                </div>
            </div>
        </CardHeader>
    </Card>
);
