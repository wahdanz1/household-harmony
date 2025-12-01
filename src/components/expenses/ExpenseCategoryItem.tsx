import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Check } from "lucide-react";
import { getCategoryById } from "@/constants/expenseCategories";

interface ExpenseCategoryItemProps {
    category: any;
    amount: string;
    currency: string;
    members: any[];
    hasEntry: boolean;
    isDifferent: boolean;
    creditExpenses?: any[];
    onAmountChange: (categoryId: string, value: string) => void;
    onEdit: (category: any) => void;
}

export const ExpenseCategoryItem = ({
    category,
    amount,
    currency,
    members,
    hasEntry,
    isDifferent,
    creditExpenses = [],
    onAmountChange,
    onEdit,
}: ExpenseCategoryItemProps) => {
    // Helper to calculate display amount (includes water cost for Rent if not included)
    const getDisplayAmount = (): string => {
        const baseAmount = parseFloat(amount || "0");

        // For Rent category, add water cost if not included
        if (category.category === "rent" && category.metadata) {
            const waterIncluded = category.metadata.water_included !== false;
            const waterCost = parseFloat(category.metadata.water_cost || "0");

            if (!waterIncluded && waterCost > 0) {
                return (baseAmount + waterCost).toString();
            }
        }

        return baseAmount.toString();
    };

    const creator = members.find(m => m.user_id === category.created_by);
    const initials = creator?.profiles?.full_name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase() || '?';

    const cat = getCategoryById(category.category || 'other');
    const Icon = cat?.icon;

    return (
        <div className="p-2 sm:p-4 rounded-lg border border-border bg-background/40">
            {/* Mobile: Compact layout */}
            <div className="sm:hidden space-y-3">
                {/* Top row: Icon + Title + Avatar */}
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" style={{ color: cat.color }} />}
                    <p className="font-medium flex-1 truncate">{category.name}</p>
                    {/* Credit badge for credit expenses */}
                    {category.type === 'credit' && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                            Credit
                        </Badge>
                    )}
                    <Avatar className="h-5 w-5 shrink-0">
                        <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                </div>

                {/* Bottom row: Amount input and edit button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <input
                            type="number"
                            value={category.type === 'credit' && creditExpenses.length > 0 ? creditExpenses[0].amount : getDisplayAmount()}
                            onChange={(e) => onAmountChange(category.id, e.target.value)}
                            disabled={category.type === "static" || category.type === "credit"}
                            className={`w-full text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 ${(category.type === "static" || category.type === "credit") ? "opacity-50 cursor-not-allowed" : ""} `}
                            placeholder="0"
                        />
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{currency}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => onEdit(category)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Desktop: Single line layout */}
            <div className="hidden sm:flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" style={{ color: cat.color }} />}
                        <p className="font-medium flex-1 truncate">{category.name}</p>
                        <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                            style={{
                                backgroundColor: `${cat?.color}20`,
                                color: cat?.color
                            }}
                        >
                            {cat?.label}
                        </span>
                        {/* Credit badge for credit expenses */}
                        {category.type === 'credit' && (
                            <Badge variant="secondary" className="text-xs">
                                Credit
                            </Badge>
                        )}
                        {hasEntry && <Check className="h-4 w-4 text-success shrink-0" />}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={category.type === 'credit' && creditExpenses.length > 0 ? creditExpenses[0].amount : getDisplayAmount()}
                        onChange={(e) => onAmountChange(category.id, e.target.value)}
                        disabled={category.type === "static" || category.type === "credit"}
                        className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 ${(category.type === "static" || category.type === "credit") ? "opacity-50 cursor-not-allowed" : ""}`}
                        placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(category)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* Credit Card Expenses for this category - only show for non-credit items */}
            {category.type !== 'credit' && creditExpenses.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {creditExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 flex-1">
                                <Badge variant="secondary" className="text-xs">
                                    Credit
                                </Badge>
                                <span className="text-muted-foreground">{expense.description}</span>
                                <span className="text-xs text-muted-foreground">• {expense.credit_cards?.name}</span>
                            </div>
                            <span className="font-medium">{expense.amount.toFixed(0)} {currency}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
