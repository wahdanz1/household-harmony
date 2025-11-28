import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";

interface IncomeSourceItemProps {
    source: any;
    amount: string;
    currency: string;
    onAmountChange: (sourceId: string, value: string) => void;
    onEdit: (source: any) => void;
    onDelete: (sourceId: string) => void;
}

export const IncomeSourceItem = ({
    source,
    amount,
    currency,
    onAmountChange,
    onEdit,
    onDelete,
}: IncomeSourceItemProps) => {
    const isSkipped = amount === "0";
    const isDifferent = amount !== source.default_amount.toString();

    return (
        <div className="p-3 sm:p-4 rounded-lg border border-border bg-background/40">
            {/* Mobile: Compact layout */}
            <div className="sm:hidden space-y-3">
                {/* Top row: Avatar + Title + Toggle */}
                <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                        <AvatarImage src={source.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                            {source.profiles.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                            {source.name}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                            {source.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </Badge>
                    </div>
                    <Switch
                        checked={!isSkipped}
                        onCheckedChange={(checked) =>
                            onAmountChange(source.id, checked ? source.default_amount.toString() : "0")
                        }
                        className="scale-90"
                    />
                </div>

                {/* Bottom row: Amount input and actions */}
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={amount || ""}
                        onChange={(e) => onAmountChange(source.id, e.target.value)}
                        className={`flex-1 text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="0"
                        disabled={isSkipped}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => onEdit(source)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => onDelete(source.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Desktop: Single line layout */}
            <div className="hidden sm:flex items-center gap-4">
                <Switch
                    checked={!isSkipped}
                    onCheckedChange={(checked) =>
                        onAmountChange(source.id, checked ? source.default_amount.toString() : "0")
                    }
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                            {source.name}
                        </p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                            {source.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {source.profiles.full_name}
                    </p>
                </div>
                <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={source.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                        {source.profiles.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={amount || ""}
                        onChange={(e) => onAmountChange(source.id, e.target.value)}
                        className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="0"
                        disabled={isSkipped}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(source)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(source.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
