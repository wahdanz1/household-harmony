import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Home, CreditCard, Shield, Pencil, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { getCategoryById } from "@/constants/expenseCategories";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpenseItem {
    id: string;
    name: string;
    amount: number;
    defaultAmount?: number;
    category?: string;
    // Optional custom display (e.g., "1780 SEK/year" instead of calculated monthly)
    displayAmount?: number;
    displayLabel?: string; // e.g., "/year", "/quarter", "/6 mo", "/month"
    // For color-coded subscriptions
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    isDue?: boolean; // Is this subscription due in the current financial month?
}

interface ExpenseBlockProps {
    title: string;
    total: number;
    currency: string;
    icon: React.ReactNode;
    items: ExpenseItem[];
    colorClass?: string;
    headerMetrics?: React.ReactNode; // Metrics shown in the header (always visible)
    severity?: 'default' | 'warning' | 'danger'; // Border color severity
    severityMessage?: string; // Tooltip message explaining the severity
    onItemClick?: (id: string) => void;
    onAmountChange?: (id: string, amount: string) => void;
    editable?: boolean;
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
    colorClass = "text-foreground",
    headerMetrics,
    severity = 'default',
    severityMessage,
    onItemClick,
    onAmountChange,
    editable = false,
}: ExpenseBlockProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Severity styling for the block border
    const severityBorderClass = severity === 'danger'
        ? 'border-red-500 border-2'
        : severity === 'warning'
            ? 'border-amber-500 border-2'
            : 'border-border';

    return (
        <div
            className={`rounded-lg bg-muted/40 ${severityBorderClass}`}
        >
            {/* Header row - always clickable to expand */}
            <div
                className="p-3 sm:p-4 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => items.length > 0 && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">{items.length} items</p>
                    </div>
                    {/* Warning indicator with tooltip */}
                    {severity !== 'default' && severityMessage && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`shrink-0 ${severity === 'danger' ? 'text-red-500' : 'text-amber-500'}`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                                <p>{severityMessage}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <p className={`text-xl font-bold whitespace-nowrap ${colorClass}`}>
                        {total.toFixed(0)} {currency}
                    </p>
                    {items.length > 0 && (
                        <div className="shrink-0 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                    )}
                </div>
                {/* Header metrics - always visible below the title row */}
                {headerMetrics && (
                    <div className="mt-2 ml-8">
                        {headerMetrics}
                    </div>
                )}
            </div>

            {/* Expanded content */}
            {isExpanded && items.length > 0 && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-border">

                    {/* Items list */}
                    <div className="pt-3 space-y-1">
                        {items.map((item) => {
                            const cat = item.category ? getCategoryById(item.category) : null;
                            const Icon = cat?.icon;
                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between text-sm py-2 px-2 -mx-2 rounded hover:bg-muted/80 cursor-pointer group transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onItemClick?.(item.id);
                                    }}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: cat?.color }} />}
                                        <span className={`truncate ${
                                            // Color name based on billing cycle and due status
                                            item.billingCycle === 'monthly' || !item.billingCycle
                                                ? 'text-foreground' // White for monthly
                                                : item.isDue
                                                    ? 'text-foreground' // White when due
                                                    : 'text-muted-foreground' // Muted otherwise
                                            }`}>{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        {editable && onAmountChange ? (
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={item.amount.toFixed(0)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        onAmountChange(item.id, e.target.value);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-20 sm:w-24 h-9 text-right text-sm font-medium pr-1"
                                                    style={{
                                                        borderBottomWidth: '2px',
                                                        borderBottomColor: item.defaultAmount !== undefined && Math.abs(item.amount - item.defaultAmount) < 0.01
                                                            ? '#22c55e'  // green-500 = matches default
                                                            : '#84cc16', // lime-500 = overridden
                                                    }}
                                                />
                                            </div>
                                        ) : item.displayAmount !== undefined ? (
                                            // Custom display with billing cycle colors
                                            <span className={`font-medium whitespace-nowrap ${item.billingCycle === 'monthly' || !item.billingCycle
                                                ? 'text-foreground' // White for monthly
                                                : item.isDue
                                                    ? item.billingCycle === 'yearly'
                                                        ? 'text-red-500' // Red for yearly due
                                                        : 'text-amber-500' // Yellow for quarterly due
                                                    : 'text-muted-foreground' // Muted otherwise
                                                }`}>
                                                {item.displayAmount.toFixed(0)} {currency}{item.displayLabel}
                                            </span>
                                        ) : (
                                            // Default display (calculated amount)
                                            <>
                                                <span className="font-medium whitespace-nowrap">{(item.amount ?? 0).toFixed(0)}</span>
                                                <span className="text-xs text-muted-foreground min-w-[28px]">{currency}</span>
                                            </>
                                        )}
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface AllTabBlockViewProps {
    expenses: ExpenseItem[];
    subscriptions: { id: string; name: string; amount: number; billing_cycle: string; total_amount?: number; isDue?: boolean }[];
    insurances: { id: string; name: string; monthly_cost: number; total_amount: number; payment_frequency: string }[];
    subscriptionsTotal: number;
    insuranceTotal: number;
    currency: string;
    subscriptionSeverity?: 'default' | 'warning' | 'danger';
    onExpenseClick?: (id: string) => void;
    onSubscriptionClick?: (id: string) => void;
    onInsuranceClick?: (id: string) => void;
    onAmountChange?: (id: string, amount: string) => void;
}

/**
 * Block view for the All tab - shows grouped expense totals with expandable details
 */
export const AllTabBlockView = ({
    expenses,
    subscriptions,
    insurances,
    subscriptionsTotal,
    insuranceTotal,
    currency,
    subscriptionSeverity = 'default',
    onExpenseClick,
    onSubscriptionClick,
    onInsuranceClick,
    onAmountChange,
}: AllTabBlockViewProps) => {
    const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
    const grandTotal = expensesTotal + subscriptionsTotal + insuranceTotal;

    // Convert subscriptions to ExpenseItem format with display info
    const subscriptionItems: ExpenseItem[] = subscriptions.map(sub => {
        // Map billing_cycle to display label
        const cycleLabels: Record<string, string> = {
            'yearly': '/year',
            'quarterly': '/quarter',
            'monthly': '/month',
        };
        const displayLabel = cycleLabels[sub.billing_cycle] || '/month';
        const actualAmount = sub.total_amount ?? sub.amount; // Use total_amount if available

        return {
            id: sub.id,
            name: sub.name,
            amount: sub.billing_cycle === 'yearly' ? parseFloat(sub.amount.toString()) / 12 : parseFloat(sub.amount.toString()),
            displayAmount: actualAmount,
            displayLabel,
            billingCycle: sub.billing_cycle as 'monthly' | 'quarterly' | 'yearly',
            isDue: sub.isDue,
        };
    });

    // Convert insurances to ExpenseItem format with display info
    const insuranceItems: ExpenseItem[] = insurances.map(ins => {
        // Map payment_frequency to display label
        const frequencyLabels: Record<string, string> = {
            'yearly': '/year',
            'semi_annually': '/6 mo',
            'quarterly': '/quarter',
            'monthly': '/month',
        };
        const displayLabel = frequencyLabels[ins.payment_frequency] || '/year';

        return {
            id: ins.id,
            name: ins.name,
            amount: ins.monthly_cost ?? 0, // Used for calculations
            displayAmount: ins.total_amount, // Actual payment amount
            displayLabel, // e.g., "/year"
        };
    });

    // Calculate subscription metrics (actual yearly cost)
    const yearlySubscriptions = subscriptions.reduce((sum, s) => {
        const amount = parseFloat(s.amount.toString());
        // Each billing cycle contributes differently to yearly total
        if (s.billing_cycle === 'yearly') return sum + amount; // Pay once per year
        if (s.billing_cycle === 'quarterly') return sum + amount * 4; // Pay 4 times per year
        return sum + amount * 12; // Monthly: pay 12 times per year
    }, 0);
    const averageSub = subscriptionItems.length > 0
        ? subscriptionItems.reduce((sum, s) => sum + s.amount, 0) / subscriptionItems.length
        : 0;

    // Calculate insurance metrics  
    const yearlyInsurance = insuranceTotal * 12;
    const averageInsurance = insuranceItems.length > 0
        ? insuranceItems.reduce((sum, i) => sum + i.amount, 0) / insuranceItems.length
        : 0;

    return (
        <div className="space-y-3">
            {/* Expenses Block (combined Fixed + Variable) */}
            {expenses.length > 0 && (
                <ExpenseBlock
                    title="Expenses"
                    total={expensesTotal}
                    currency={currency}
                    icon={<Home className="h-5 w-5 text-blue-500" />}
                    items={expenses}
                    onItemClick={onExpenseClick}
                    editable={!!onAmountChange}
                    onAmountChange={onAmountChange}
                />
            )}

            {/* Subscriptions Block with metrics in header */}
            {subscriptionsTotal > 0 && (
                <ExpenseBlock
                    title="Subscriptions"
                    total={subscriptionsTotal}
                    currency={currency}
                    icon={<CreditCard className="h-5 w-5 text-purple-500" />}
                    items={subscriptionItems}
                    onItemClick={onSubscriptionClick}
                    severity={subscriptionSeverity}
                    severityMessage={
                        subscriptionSeverity === 'danger'
                            ? "A yearly subscription is due this month!"
                            : subscriptionSeverity === 'warning'
                                ? "A quarterly subscription is due this month"
                                : undefined
                    }
                    headerMetrics={
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{subscriptionsTotal.toFixed(0)} {currency}/month</span>
                            <span>{yearlySubscriptions.toFixed(0)} {currency}/year</span>
                            <span>{averageSub.toFixed(0)} {currency} avg</span>
                        </div>
                    }
                />
            )}

            {/* Insurances Block with metrics in header */}
            {insuranceTotal > 0 && (
                <ExpenseBlock
                    title="Insurances"
                    total={insuranceTotal}
                    currency={currency}
                    icon={<Shield className="h-5 w-5 text-amber-500" />}
                    items={insuranceItems}
                    onItemClick={onInsuranceClick}
                    headerMetrics={
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{insuranceTotal.toFixed(0)} {currency}/month</span>
                            <span>{yearlyInsurance.toFixed(0)} {currency}/year</span>
                            <span>{averageInsurance.toFixed(0)} {currency} avg</span>
                        </div>
                    }
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
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer group"
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
                        <div className="flex items-center gap-2">
                            <span className="font-bold whitespace-nowrap">{item.amount.toFixed(0)} {currency}</span>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
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
