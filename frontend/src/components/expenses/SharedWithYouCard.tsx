import { Users, Baby } from "lucide-react";
import { Card } from "@/components/ui/card";
import { fmtKr } from "@/components/ui/money";
import { SettingsBadge } from "@/components/settings/SettingsCard";
import { useAuth } from "@/contexts/AuthContext";
import { useCoParentSpaceContext } from "@/hooks/useCoParentSpaceContext";
import { useSharedCostClaims } from "@/hooks/useSharedCostClaims";

interface SharedWithYouCardProps {
    currency?: string;
}

/**
 * Costs a co-parent has published to you.
 *
 * Rendered as its own block rather than merged into the insurance list on
 * purpose: those lists feed the household's totals and budget maths, and a cost
 * belonging to someone else's household must never land in them. Keeping the
 * data in a separate array is what guarantees that, rather than a filter
 * somebody has to remember to apply in every calculation.
 */
export const SharedWithYouCard = ({ currency = "SEK" }: SharedWithYouCardProps) => {
    const { user } = useAuth();
    const { spaces } = useCoParentSpaceContext(user?.id);
    const space = spaces[0];
    const { incoming } = useSharedCostClaims(space?.id, user?.id);

    if (!space || incoming.length === 0) return null;

    const yourTotal = incoming.reduce((sum, c) => {
        if (c.amount === null || c.sharePercentage === null) return sum;
        return sum + (c.amount * (100 - c.sharePercentage)) / 100;
    }, 0);

    return (
        <Card variant="flush">
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5 border-b border-line-2">
                <span className="flex items-center gap-2 min-w-0">
                    <Users className="h-4 w-4 text-muted shrink-0" />
                    <span className="font-semibold text-ink truncate">Shared with you</span>
                    <SettingsBadge>Co-parent</SettingsBadge>
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums shrink-0">
                    {fmtKr(yourTotal, currency)}
                </span>
            </div>

            <ul className="divide-y divide-line-2">
                {incoming.map(claim => {
                    const yourShare =
                        claim.amount !== null && claim.sharePercentage !== null
                            ? (claim.amount * (100 - claim.sharePercentage)) / 100
                            : null;
                    return (
                        <li key={claim.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-ink truncate">{claim.label ?? "Shared cost"}</p>
                                    {claim.subject && (
                                        <span className="flex items-center gap-1 text-xs text-muted">
                                            <Baby className="h-3 w-3" />
                                            {claim.subject}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted mt-0.5">
                                    {claim.amount !== null ? fmtKr(claim.amount, currency) : "—"} total
                                    {claim.sharePercentage !== null && ` · your share ${100 - claim.sharePercentage}%`}
                                </p>
                            </div>
                            <span className="text-sm font-semibold text-ink tabular-nums shrink-0">
                                {yourShare !== null ? fmtKr(yourShare, currency) : "—"}
                            </span>
                        </li>
                    );
                })}
            </ul>

            <p className="px-4 sm:px-5 py-2.5 text-xs text-muted border-t border-line-2">
                Published by your co-parent. Not counted in your own totals.
            </p>
        </Card>
    );
};
