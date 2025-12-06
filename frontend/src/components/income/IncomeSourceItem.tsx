import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Edit, Check } from "lucide-react";
import { getIncomeCategoryById } from "@/constants/incomeCategories";
import { DataListItem } from "@/components/ui/data-list-item";

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
    status = 'none',
}: IncomeSourceItemProps & { status?: 'saved' | 'modified' | 'none' }) => {
    const isSkipped = amount === "0";

    const cat = getIncomeCategoryById(source.category);
    const Icon = cat?.icon;

    // Bottom underline on input: shows save status
    const getInputUnderlineClass = () => {
        if (isSkipped) return 'border-border';
        switch (status) {
            case 'saved':
                return 'border-green-500';
            case 'modified':
                return 'border-lime-400';
            default:
                return 'border-border';
        }
    };

    return (
        <DataListItem onClick={() => onEdit(source)}>
            {/* Mobile: Compact layout - horizontal toggle, no edit button */}
            <div className="sm:hidden space-y-3">
                {/* Top row: Icon + Title + Avatar */}
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" style={{ color: cat?.color }} />}
                    <p className={`font-medium flex-1 truncate ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                        {source.name}
                    </p>
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={source.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                            {source.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* Bottom row: Amount input, currency, and horizontal toggle */}
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <input
                            type="number"
                            value={amount || ""}
                            onChange={(e) => onAmountChange(source.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${getInputUnderlineClass()} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                            placeholder="0"
                            disabled={isSkipped}
                        />
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{currency}</span>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                            checked={!isSkipped}
                            onCheckedChange={(checked) =>
                                onAmountChange(source.id, checked ? source.default_amount.toString() : "0")
                            }
                            className="data-[state=unchecked]:bg-muted"
                        />
                    </div>
                </div>
            </div>

            {/* Desktop: Single line layout with vertical toggle */}
            <div className="hidden sm:flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" style={{ color: cat?.color }} />}
                        <p className={`font-medium ${isSkipped ? "line-through text-muted-foreground" : ""}`}>
                            {source.name}
                        </p>
                        {cat && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                                style={{
                                    backgroundColor: `${cat?.color}20`,
                                    color: cat?.color
                                }}
                            >
                                {cat.label}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={amount || ""}
                        onChange={(e) => onAmountChange(source.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${getInputUnderlineClass()} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="0"
                        disabled={isSkipped}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(source);
                        }}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={source.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-sm">
                            {source.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                    {/* Vertical toggle - rotated -90deg so dot is on top when ON */}
                    <div
                        className="flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Switch
                            checked={!isSkipped}
                            onCheckedChange={(checked) =>
                                onAmountChange(source.id, checked ? source.default_amount.toString() : "0")
                            }
                            className="-rotate-90 data-[state=unchecked]:bg-muted"
                        />
                    </div>
                </div>
            </div>
        </DataListItem>
    );
};
