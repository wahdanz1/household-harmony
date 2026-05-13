import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SkeletonText = ({ className }: { className?: string }) => (
    <span
        aria-hidden
        className={cn(
            "inline-block align-baseline rounded-md bg-surface-2 animate-pulse text-transparent select-none",
            className,
        )}
    >
        &#8203;
    </span>
);

export const HeroCardSkeleton = ({ extraLine = false }: { extraLine?: boolean }) => (
    <Card>
        <p className="text-xs font-medium tracking-wide">
            <SkeletonText className="w-36 h-[1lh]" />
        </p>
        <div className="mt-1">
            <span className="font-mono text-4xl font-semibold tracking-tighter">
                <SkeletonText className="w-44 h-[1lh]" />
            </span>
        </div>
        <p className="mt-1 text-xs">
            <SkeletonText className="w-56 h-[1lh]" />
        </p>
        {extraLine && (
            <button
                type="button"
                disabled
                aria-hidden
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold"
            >
                <SkeletonText className="w-3.5 h-3.5 rounded-sm" />
                <SkeletonText className="w-32 h-[1lh]" />
            </button>
        )}
    </Card>
);

export const TabsListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="flex w-full items-center gap-0.5 p-1 rounded-xl bg-surface-2 border border-line">
        {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-9 flex-1 rounded-[9px]" />
        ))}
    </div>
);

export const ButtonsRowSkeleton = () => (
    <div className="hidden sm:grid grid-cols-2 gap-5">
        <Button size="lg" disabled className="w-full justify-center bg-surface-2 border-line">
            <Skeleton className="h-4 w-24 bg-surface" />
        </Button>
        <Button size="lg" variant="outline" disabled className="w-full justify-center">
            <Skeleton className="h-4 w-28" />
        </Button>
    </div>
);

export const MobileBottomButtonsSkeleton = () => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-5 sm:hidden">
        <Button size="lg" disabled className="w-full justify-center bg-surface-2 border-line">
            <Skeleton className="h-4 w-24 bg-surface" />
        </Button>
        <Button size="lg" variant="outline" disabled className="w-full justify-center">
            <Skeleton className="h-4 w-28" />
        </Button>
    </div>
);

/**
 * Mirrors ExpenseBlock header row. Same outer + inner classes as the live block,
 * so heights match exactly even when those classes change later.
 */
export const SummaryBlockSkeleton = ({ withMetrics = false }: { withMetrics?: boolean }) => (
    <div className="rounded-[14px] bg-surface overflow-hidden border border-line">
        <div className="px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 shrink-0 rounded" />
                <div className="flex-1 min-w-0">
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="mt-0.5 h-4 w-16" />
                </div>
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-4 shrink-0" />
            </div>
            {withMetrics && (
                <div className="mt-2 ml-9 flex flex-wrap gap-x-4 gap-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
            )}
        </div>
    </div>
);

/**
 * Mirrors Income card: flush card with header row + N source rows.
 * Header uses same px-5 py-4 + border-b as live; rows mirror RowItem padding.
 */
export const ListBlockSkeleton = ({ rows = 3 }: { rows?: number }) => (
    <Card variant="flush">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line-2">
            <Skeleton className="h-5 w-5 rounded" />
            <div>
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-24" />
            </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
            <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 ${i === rows - 1 ? "" : "border-b border-line-2"}`}
            >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Skeleton className="h-7 w-24 sm:w-28" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                </div>
            </div>
        ))}
    </Card>
);

export const CardSkeleton = ({ rows = 3 }: { rows?: number }) => (
    <Card variant="flush">
        {Array.from({ length: rows }).map((_, i) => (
            <div
                key={i}
                className={`flex items-center justify-between px-5 py-4 ${i === rows - 1 ? "" : "border-b border-line-2"}`}
            >
                <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-7 w-20" />
            </div>
        ))}
    </Card>
);

export const IncomePageSkeleton = () => (
    <>
        <HeroCardSkeleton extraLine />
        <ButtonsRowSkeleton />
        <ListBlockSkeleton rows={3} />
        <MobileBottomButtonsSkeleton />
    </>
);

export const ExpensesPageSkeleton = () => (
    <>
        <HeroCardSkeleton />
        <TabsListSkeleton />
        <ButtonsRowSkeleton />
        <SummaryBlockSkeleton />
        <SummaryBlockSkeleton withMetrics />
        <SummaryBlockSkeleton withMetrics />
        <MobileBottomButtonsSkeleton />
    </>
);

export const OverviewSkeleton = () => (
    <>
        <Card variant="flush">
            <div className="p-5 border-b border-line-2">
                <p className="text-xs font-medium tracking-wide">
                    <SkeletonText className="w-32 h-[1lh]" />
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-semibold tracking-tighter">
                        <SkeletonText className="w-44 h-[1lh]" />
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <p className="text-xs font-medium tracking-wide">
                        <SkeletonText className="w-20 h-[1lh]" />
                    </p>
                    <span className="font-mono text-base font-medium">
                        <SkeletonText className="w-24 h-[1lh]" />
                    </span>
                </div>
                <div className="mt-3">
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <p className="mt-1.5 text-xs">
                        <SkeletonText className="w-28 h-[1lh]" />
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2">
                <div className="p-4 px-5 border-r border-line-2">
                    <p className="text-xs flex items-center gap-1.5">
                        <SkeletonText className="w-3 h-3 rounded-sm" />
                        <SkeletonText className="w-12 h-[1lh]" />
                    </p>
                    <div className="mt-1">
                        <span className="font-mono text-lg font-semibold">
                            <SkeletonText className="w-24 h-[1lh]" />
                        </span>
                    </div>
                </div>
                <div className="p-4 px-5">
                    <p className="text-xs flex items-center gap-1.5">
                        <SkeletonText className="w-3 h-3 rounded-sm" />
                        <SkeletonText className="w-16 h-[1lh]" />
                    </p>
                    <div className="mt-1">
                        <span className="font-mono text-lg font-semibold">
                            <SkeletonText className="w-24 h-[1lh]" />
                        </span>
                    </div>
                </div>
            </div>
        </Card>
        <section>
            <div className="flex items-baseline justify-between mb-3 px-0.5">
                <span className="text-[11.5px] font-semibold uppercase">
                    <SkeletonText className="w-20 h-[1lh]" />
                </span>
                <span className="text-[12.5px] font-semibold">
                    <SkeletonText className="w-16 h-[1lh]" />
                </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricTileSkeleton />
                <MetricTileSkeleton />
            </div>
        </section>
    </>
);

const MetricTileSkeleton = () => (
    <div className="rounded-[14px] border border-line bg-surface p-4 flex flex-col gap-2.5 min-h-[124px]">
        <div className="flex items-center justify-between">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <span className="text-[11.5px] font-semibold">
                <SkeletonText className="w-4 h-[1lh]" />
            </span>
        </div>
        <div>
            <div className="text-[12.5px] font-medium">
                <SkeletonText className="w-24 h-[1lh]" />
            </div>
            <div className="mt-1">
                <span className="font-mono text-base font-semibold">
                    <SkeletonText className="w-20 h-[1lh]" />
                </span>
            </div>
            <div className="mt-0.5 text-[11.5px]">
                <SkeletonText className="w-16 h-[1lh]" />
            </div>
        </div>
        <div className="mt-auto text-[11.5px]">
            <SkeletonText className="w-20 h-[1lh]" />
        </div>
    </div>
);

export const CreditTabSkeleton = () => <CardSkeleton rows={3} />;

export const SettingsPageSkeleton = () => (
    <>
        <TabsListSkeleton />
        <div className="grid gap-5 lg:grid-cols-2">
            <CardWithHeaderSkeleton rows={2} />
            <CardWithHeaderSkeleton rows={3} />
        </div>
        <CardWithHeaderSkeleton rows={2} />
        <CardWithHeaderSkeleton rows={1} />
    </>
);

const CardWithHeaderSkeleton = ({ rows = 2 }: { rows?: number }) => (
    <Card>
        <div className="space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
        </div>
        <div className="mt-4 space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
        </div>
    </Card>
);
