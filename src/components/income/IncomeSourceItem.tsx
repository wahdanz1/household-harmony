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
    const isDifferent = amount !== source.default_amount.toString();

    const cat = getIncomeCategoryById(source.category);
    const Icon = cat?.icon;

    const getStatusBorderClass = () => {
        switch (status) {
            case 'saved':
                return 'border-l-4 border-l-green-500 pl-2';
            case 'modified':
                return 'border-l-4 border-l-lime-400 pl-2';
            default:
                return 'pl-3'; // Default padding to align with bordered items
        }
    };

    return (
        <DataListItem onClick={() => onEdit(source)} className={getStatusBorderClass()}>
            {/* Mobile: Compact layout */}
            <div className="sm:hidden space-y-3">
                {/* Top row: Icon + Title + Avatar */}
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" style={{ color: cat?.color }} />}
                    <p className="font-medium flex-1 truncate">{source.name}</p>
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={source.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                            {source.profiles?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "?"}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* Bottom row: Amount input and edit button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <input
                            type="number"
                            value={amount || ""}
                            onChange={(e) => onAmountChange(source.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()} // Prevent opening edit dialog
                            className={`w-full text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${isSkipped ? "border-border" : (isDifferent ? "border-primary" : "border-border")} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                            placeholder="0"
                            disabled={isSkipped}
                        />
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{currency}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(source);
                        }}
                    >
                        <Edit className="h-4 w-4" />
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
                    onClick={(e) => e.stopPropagation()}
                />
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
                        onClick={(e) => e.stopPropagation()} // Prevent opening edit dialog
                        className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${isSkipped ? "border-border" : (isDifferent ? "border-primary" : "border-border")} focus:outline-none focus:border-primary rounded-none px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed`}
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
                </div>
            </div>
        </DataListItem>
    );
};
