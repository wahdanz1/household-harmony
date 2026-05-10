import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const skeletonRow = (key: number, last = false) => (
    <div
        key={key}
        className={`flex items-center justify-between px-5 py-4 ${last ? "" : "border-b border-line-2"}`}
    >
        <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-7 w-20" />
    </div>
);

/** Generic card-shaped skeleton, neutral about content. */
export const CardSkeleton = ({ rows = 3 }: { rows?: number }) => (
    <Card variant="flush">
        {Array.from({ length: rows }).map((_, i) => skeletonRow(i, i === rows - 1))}
    </Card>
);

export const DashboardSkeleton = () => (
    <Card variant="flush">
        <div className="p-5 border-b border-line-2 space-y-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-24" />
        </div>
        <div className="grid grid-cols-2">
            <div className="p-4 px-5 space-y-2 border-r border-line-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
            </div>
            <div className="p-4 px-5 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-24" />
            </div>
        </div>
    </Card>
);

export const IncomePageSkeleton = () => <CardSkeleton rows={3} />;

export const ExpensesPageSkeleton = () => <CardSkeleton rows={3} />;

export const CreditTabSkeleton = () => <CardSkeleton rows={3} />;
