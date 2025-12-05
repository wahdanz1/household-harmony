import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Check, ExternalLink } from "lucide-react";
import { getCategoryById } from "@/constants/expenseCategories";
import { DataListItem } from "@/components/ui/data-list-item";

interface RegularExpenseItemProps {
    category: any;
    amount: string;
    currency: string;
    members: any[];
    hasEntry: boolean;
    isDifferent?: boolean;
    creditExpenses?: any[];
    onAmountChange?: (categoryId: string, value: string) => void;
    onEdit: (category: any) => void;
    onNavigateToCredit?: () => void;
}

export const RegularExpenseItem = ({
    category,
    amount,
    currency,
    members,
    hasEntry,
    isDifferent,
    creditExpenses = [],
    onAmountChange = () => { },
    onEdit,
    onNavigateToCredit,
    status = 'none'
}: RegularExpenseItemProps & { status?: 'saved' | 'modified' | 'none' }) => {
    const getDisplayAmount = () => {
        const baseAmount = parseFloat(amount || "0");

        // For Rent category, add water cost if not included
        if (category.category === "rent" && category.metadata) {
            const waterIncluded = category.metadata.water_included !== false;
            const waterCost = parseFloat(category.metadata.water_cost || "0");

            if (!waterIncluded && waterCost > 0) {
                return (baseAmount + waterCost).toString();
            }
        }

        // Only add credit card expenses if this is a pure credit category (unmatched)
        // For regular categories, we want to show the base amount only, 
        // and list credit expenses separately below
        if (category.type === 'credit') {
            const creditTotal = creditExpenses.reduce((sum, expense) => {
                const val = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
                return sum + (isNaN(val) ? 0 : val);
            }, 0);
            return (baseAmount + creditTotal).toString();
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
        <DataListItem onClick={() => onEdit(category)} className={getStatusBorderClass()}>
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
                    {category.type !== 'credit' && (
                        <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                    )}
                </div>

                {/* Bottom row: Amount input and edit button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <input
                            type="number"
                            value={getDisplayAmount()}
                            onChange={(e) => onAmountChange(category.id, e.target.value)}
                            disabled={category.type === "static" || category.type === "credit"}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-full text-right text-lg font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 ${(category.type === "static" || category.type === "credit") ? "opacity-50 cursor-not-allowed" : ""} `}
                            placeholder="0"
                        />
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{currency}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(category);
                        }}
                    >
                        {category.type === 'credit' ? <ExternalLink className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Desktop: Single line layout */}
            <div className="hidden sm:flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" style={{ color: cat.color }} />}
                        <p className="font-medium truncate">{category.name}</p>
                        <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
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
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={getDisplayAmount()}
                        onChange={(e) => onAmountChange(category.id, e.target.value)}
                        disabled={category.type === "static" || category.type === "credit"}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-32 text-right text-xl font-semibold bg-transparent border-0 border-b-2 ${isDifferent ? "border-primary" : "border-border"} focus:outline-none focus:border-primary rounded-none px-2 py-1 ${(category.type === "static" || category.type === "credit") ? "opacity-50 cursor-not-allowed" : ""}`}
                        placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(category);
                        }}
                    >
                        {category.type === 'credit' ? <ExternalLink className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                    </Button>
                    {category.type !== 'credit' && (
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={creator?.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
            </div>

            {/* Credit Card Expenses for this category - only show for non-credit items */}
            {category.type !== 'credit' && creditExpenses.length > 0 && (
                <div className="mt-2 pl-4 border-l-2 border-border space-y-2">
                    {creditExpenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between text-sm py-1 gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-muted-foreground/30">
                                    Credit
                                </Badge>
                                <span className="text-muted-foreground truncate">{expense.description}</span>
                                <span className="text-xs text-muted-foreground/60 whitespace-nowrap">• {expense.credit_cards?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={expense.amount}
                                    disabled
                                    className="w-24 sm:w-32 text-right text-lg sm:text-xl font-semibold bg-transparent border-0 border-b-2 border-border rounded-none px-2 py-1 opacity-50 cursor-not-allowed"
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap">{currency}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToCredit?.();
                                }}
                                className="h-9 w-9 shrink-0"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </DataListItem>
    );
};
