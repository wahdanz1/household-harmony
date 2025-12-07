import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Home, ShoppingCart, CreditCard, Shield } from "lucide-react";
import { useState } from "react";
import { getCategoryById } from "@/constants/expenseCategories";

interface ExpenseItem {
    id: string;
    name: string;
    amount: number;
    category?: string;
}

interface ExpenseBlockProps {
    title: string;
    total: number;
    currency: string;
    icon: React.ReactNode;
    items: ExpenseItem[];
    onNavigate?: () => void;
    colorClass?: string;
}

/**
 * A collapsible expense summary block showing category total with expandable item list
 */
export const ExpenseBlock = ({
    title,
    total,
    currency,
    icon,
    items,
    onNavigate,
    colorClass = "text-foreground"
}: ExpenseBlockProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className="p-3 sm:p-4 rounded-lg border border-border bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
            onClick={() => items.length > 0 && setIsExpanded(!isExpanded)}
        >
            {/* Header row */}
            <div className="flex items-center gap-3">
                <div className="shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{title}</p>
                    <p className="text-xs text-muted-foreground">{items.length} items</p>
                </div>
                <p className={`text-xl font-bold whitespace-nowrap ${colorClass}`}>
                    {total.toFixed(0)} {currency}
                </p>
                {items.length > 0 && (
                    <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                )}
            </div>

            {/* Expanded items list */}
            {isExpanded && items.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                    {items.map((item) => {
                        const cat = item.category ? getCategoryById(item.category) : null;
                        const Icon = cat?.icon;
                        return (
                            <div key={item.id} className="flex items-center justify-between text-sm py-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cat?.color }} />}
                                    <span className="text-muted-foreground truncate">{item.name}</span>
                                </div>
                                <span className="font-medium whitespace-nowrap">{item.amount.toFixed(0)} {currency}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface AllTabBlockViewProps {
    fixedExpenses: ExpenseItem[];
    variableExpenses: ExpenseItem[];
    subscriptions: { id: string; name: string; amount: number; billing_cycle: string }[];
    insurances: { id: string; name: string; monthly_cost: number }[];
    subscriptionsTotal: number;
    insuranceTotal: number;
    currency: string;
    onNavigateToFixed?: () => void;
    onNavigateToVariable?: () => void;
    onNavigateToSubscriptions?: () => void;
    onNavigateToInsurance?: () => void;
}

/**
 * Block view for the All tab - shows grouped expense totals with expandable details
 */
export const AllTabBlockView = ({
    fixedExpenses,
    variableExpenses,
    subscriptions,
    insurances,
    subscriptionsTotal,
    insuranceTotal,
    currency,
    onNavigateToFixed,
    onNavigateToVariable,
    onNavigateToSubscriptions,
    onNavigateToInsurance,
}: AllTabBlockViewProps) => {
    const fixedTotal = fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
    const variableTotal = variableExpenses.reduce((sum, item) => sum + item.amount, 0);
    const grandTotal = fixedTotal + variableTotal + subscriptionsTotal + insuranceTotal;

    // Convert subscriptions to ExpenseItem format
    const subscriptionItems: ExpenseItem[] = subscriptions.map(sub => ({
        id: sub.id,
        name: sub.name,
        amount: sub.billing_cycle === 'yearly' ? parseFloat(sub.amount.toString()) / 12 : parseFloat(sub.amount.toString()),
    }));

    // Convert insurances to ExpenseItem format
    const insuranceItems: ExpenseItem[] = insurances.map(ins => ({
        id: ins.id,
        name: ins.name,
        amount: ins.monthly_cost,
    }));

    return (
        <div className="space-y-3">
            {/* Fixed Expenses Block */}
            {fixedExpenses.length > 0 && (
                <ExpenseBlock
                    title="Fixed Expenses"
                    total={fixedTotal}
                    currency={currency}
                    icon={<Home className="h-5 w-5 text-blue-500" />}
                    items={fixedExpenses}
                    onNavigate={onNavigateToFixed}
                />
            )}

            {/* Variable/Budgeted Expenses Block */}
            {variableExpenses.length > 0 && (
                <ExpenseBlock
                    title="Variable Expenses"
                    total={variableTotal}
                    currency={currency}
                    icon={<ShoppingCart className="h-5 w-5 text-green-500" />}
                    items={variableExpenses}
                    onNavigate={onNavigateToVariable}
                />
            )}

            {/* Subscriptions Block */}
            {subscriptionsTotal > 0 && (
                <ExpenseBlock
                    title="Subscriptions"
                    total={subscriptionsTotal}
                    currency={currency}
                    icon={<CreditCard className="h-5 w-5 text-purple-500" />}
                    items={subscriptionItems}
                    onNavigate={onNavigateToSubscriptions}
                />
            )}

            {/* Insurance Block */}
            {insuranceTotal > 0 && (
                <ExpenseBlock
                    title="Insurance"
                    total={insuranceTotal}
                    currency={currency}
                    icon={<Shield className="h-5 w-5 text-amber-500" />}
                    items={insuranceItems}
                    onNavigate={onNavigateToInsurance}
                />
            )}

            {/* Grand Total */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                    <p className="font-semibold text-lg">Total Monthly Expenses</p>
                    <p className="text-2xl font-bold text-destructive">{grandTotal.toFixed(0)} {currency}</p>
                </div>
            </div>
        </div>
    );
};

/**
 * Simplified list view for the All tab - clean overview style matching Blocks
 * No edit buttons, no avatars - just a clean list sorted by amount
 */
interface AllTabListViewProps {
    expenses: ExpenseItem[];
    subscriptions: { id: string; name: string; amount: number; billing_cycle: string }[];
    insurances: { id: string; name: string; monthly_cost: number }[];
    currency: string;
    onItemClick?: (id: string, type: 'expense' | 'subscription' | 'insurance') => void;
}

export const AllTabListView = ({
    expenses,
    subscriptions,
    insurances,
    currency,
    onItemClick,
}: AllTabListViewProps) => {
    // Combine all items into a unified list
    const allItems = [
        ...expenses.map(e => ({
            id: e.id,
            name: e.name,
            amount: e.amount,
            category: e.category,
            type: 'expense' as const,
        })),
        ...subscriptions.map(s => ({
            id: s.id,
            name: s.name,
            amount: s.billing_cycle === 'yearly' ? parseFloat(s.amount.toString()) / 12 : parseFloat(s.amount.toString()),
            category: 'subscription',
            type: 'subscription' as const,
        })),
        ...insurances.map(i => ({
            id: i.id,
            name: i.name,
            amount: i.monthly_cost,
            category: 'insurance',
            type: 'insurance' as const,
        })),
    ].sort((a, b) => b.amount - a.amount); // Sort by amount, highest first

    const grandTotal = allItems.reduce((sum, item) => sum + item.amount, 0);

    return (
        <div className="space-y-2">
            {allItems.map((item) => {
                const cat = item.category ? getCategoryById(item.category) : null;
                const Icon = cat?.icon || (item.type === 'subscription' ? CreditCard : item.type === 'insurance' ? Shield : null);
                const iconColor = cat?.color || (item.type === 'subscription' ? '#A855F7' : item.type === 'insurance' ? '#F59E0B' : undefined);

                return (
                    <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                        onClick={() => onItemClick?.(item.id, item.type)}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} />}
                            <span className="font-medium truncate">{item.name}</span>
                            {item.type !== 'expense' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
                                    {item.type}
                                </span>
                            )}
                        </div>
                        <span className="font-bold whitespace-nowrap">{item.amount.toFixed(0)} {currency}</span>
                    </div>
                );
            })}

            {/* Grand Total */}
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mt-4">
                <div className="flex items-center justify-between">
                    <p className="font-semibold text-lg">Total Monthly Expenses</p>
                    <p className="text-2xl font-bold text-destructive">{grandTotal.toFixed(0)} {currency}</p>
                </div>
            </div>
        </div>
    );
};
