import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface Stat {
    label: string;
    value: string | number;
    className?: string;
}

export interface SummaryStatsCardProps {
    title: string;
    description?: string;
    stats: Stat[];
    columns?: number;
}

export const SummaryStatsCard = ({
    title,
    description,
    stats,
    columns = 2,
}: SummaryStatsCardProps) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription className="mt-1.5">{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div
                    className={cn(
                        "grid gap-4",
                        columns === 2 && "grid-cols-2",
                        columns === 3 && "grid-cols-3",
                        columns === 4 && "grid-cols-4"
                    )}
                >
                    {stats.map((stat, index) => (
                        <div key={index} className="space-y-2">
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <div className={cn("text-2xl font-bold", stat.className)}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
