import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const headerRow = (
    <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-36" />
        <div className="flex items-center gap-1">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-md" />
        </div>
    </div>
);

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

export const DashboardSkeleton = () => (
    <div className="space-y-5">
        {headerRow}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton className="h-24 rounded-[14px]" />
            <Skeleton className="h-24 rounded-[14px]" />
        </div>
    </div>
);

export const IncomePageSkeleton = () => (
    <div className="space-y-5">
        {headerRow}
        <Card>
            <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-12 w-40" />
                <Skeleton className="h-3 w-48" />
            </div>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Skeleton className="h-11 rounded-md" />
            <Skeleton className="h-11 rounded-md" />
        </div>
        <Card variant="flush">
            {[0, 1, 2, 3].map((i) => skeletonRow(i, i === 3))}
        </Card>
    </div>
);

export const ExpensesPageSkeleton = () => (
    <div className="space-y-5">
        {headerRow}
        <div className="rounded-[14px] border border-line bg-surface px-5 py-4 flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Card variant="flush">
            {[0, 1, 2, 3, 4].map((i) => skeletonRow(i, i === 4))}
        </Card>
    </div>
);

export const CreditTabSkeleton = () => (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <Card variant="flush">
            {[0, 1, 2].map((i) => skeletonRow(i, i === 2))}
        </Card>
        <Card>
            <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-20 rounded-md" />
            </div>
        </Card>
    </div>
);
