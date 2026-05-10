import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Home, Repeat, Shield, Pencil, AlertTriangle, Sparkles } from "lucide-react";
import { CatIcon } from "@/components/ui/cat-icon";
import { Money } from "@/components/ui/money";
import { MoneyInput } from "@/components/ui/money-input";
import { RowItem } from "@/components/ui/row-item";
import { useState } from "react";
import { getCategoryById } from "@/constants/expenseCategories";
import { subscriptionCategories } from "@/constants/subscriptionCategories";
import { insuranceTypes } from "@/constants/insuranceTypes";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ExpenseItem {
    id: string;
    name: string;
    /** The editable/budget amount for the month. */
    amount: number;
    defaultAmount?: number;
    /** Realised amount from a credit-card invoice. When set and ≠ amount, a variance badge is shown. */
    actualAmount?: number;
    category?: string;
    // Optional custom display (e.g., "1780 SEK/year" instead of calculated monthly)
    displayAmount?: number;
    displayLabel?: string; // e.g., "/year", "/quarter", "/6 mo", "/month"
    // For color-coded subscriptions
    billingCycle?: 'monthly' | 'quarterly' | 'yearly';
    isDue?: boolean; // Is this subscription due in the current financial month?
    hasSpecialFields?: boolean; // Electricity/Rent - needs dialog to edit
}

interface ExpenseBlockProps {
    title: string;
    total: number;
    currency: string;
    icon: React.ReactNode;
    items: ExpenseItem[];
    colorClass?: string;
    headerMetrics?: React.ReactNode; // Metrics shown in the header (always visible)
    severity?: 'default' | 'upcoming' | 'warning' | 'danger'; // Border color severity
    severityMessage?: string; // Tooltip message explaining the severity
    categoryType?: 'expense' | 'subscription' | 'insurance'; // Which category constants to use
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
    categoryType = 'expense',
    onItemClick,
    onAmountChange,
    editable = false,
}: ExpenseBlockProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Helper to get category info based on type
    const getCategoryInfo = (category: string | undefined) => {
        if (!category) return null;
        if (categoryType === 'subscription') {
            return subscriptionCategories.find(c => c.value === category);
        }
        if (categoryType === 'insurance') {
            return insuranceTypes.find(c => c.value === category);
        }
        return getCategoryById(category);
    };

    // Severity styling for the block border
    const severityBorder = severity === 'danger'
        ? 'border-destructive'
        : severity === 'warning'
            ? 'border-warning'
            : severity === 'upcoming'
                ? 'border-alert'
                : 'border-line';
    const severityWidth = severity !== 'default' ? 'border-2' : 'border';
    const severityIconColor = severity === 'danger'
        ? 'text-destructive'
        : severity === 'upcoming'
            ? 'text-alert'
            : 'text-warning';

    return (
        <div className={`rounded-[14px] bg-surface overflow-hidden ${severityBorder} ${severityWidth}`}>
            {/* Header row */}
            <div
                className="px-4 py-4 sm:px-5 cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => items.length > 0 && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-ink truncate">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{items.length} items</p>
                    </div>
                    {severity !== 'default' && severityMessage && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className={`shrink-0 ${severityIconColor}`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                                <p>{severityMessage}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <Money
                        v={total}
                        currency={currency}
                        size="lg"
                        weight={600}
                        className={colorClass}
                    />
                    {items.length > 0 && (
                        <div className="shrink-0 text-muted-foreground">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                    )}
                </div>
                {headerMetrics && (
                    <div className="mt-2 ml-9">
                        {headerMetrics}
                    </div>
                )}
            </div>

            {/* Expanded items list — flush rows with thin separators */}
            {isExpanded && items.length > 0 && (
                <div className="border-t border-line-2">
                    {items.map((item, idx) => {
                        const cat = getCategoryInfo(item.category);
                        const Icon = cat?.icon;
                        const isLast = idx === items.length - 1;

                        // Display color when not editable: muted unless monthly or due
                        const displayColor = item.displayAmount !== undefined
                            ? item.billingCycle === 'monthly' || !item.billingCycle
                                ? 'text-ink'
                                : item.isDue
                                    ? item.billingCycle === 'yearly' ? 'text-destructive' : 'text-warning'
                                    : 'text-muted-foreground'
                            : 'text-ink';

                        const inputStatus =
                            item.defaultAmount !== undefined && Math.abs(item.amount - item.defaultAmount) < 0.01
                                ? 'saved'
                                : 'modified';

                        return (
                            <RowItem
                                key={item.id}
                                last={isLast}
                                onClick={() => onItemClick?.(item.id)}
                                className="group"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <CatIcon icon={Icon || Sparkles} hue={cat?.hue} size={32} />
                                    <span className={`font-medium text-sm sm:text-base truncate ${item.billingCycle === 'monthly' || !item.billingCycle || item.isDue
                                        ? 'text-ink'
                                        : 'text-muted-foreground'
                                        }`}>{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {editable && onAmountChange ? (
                                        <MoneyInput
                                            value={item.amount}
                                            currency={currency}
                                            status={inputStatus}
                                            size="base"
                                            widthClassName="w-20 sm:w-24"
                                            onChange={(v) => onAmountChange(item.id, v.toString())}
                                        />
                                    ) : item.displayAmount !== undefined ? (
                                        <span className="flex items-baseline gap-1">
                                            <Money
                                                v={item.displayAmount}
                                                currency={currency}
                                                size="base"
                                                weight={500}
                                                className={displayColor}
                                            />
                                            {item.displayLabel && (
                                                <span className="text-xs text-muted-foreground">{item.displayLabel}</span>
                                            )}
                                        </span>
                                    ) : (
                                        <Money
                                            v={item.amount ?? 0}
                                            currency={currency}
                                            size="base"
                                            weight={500}
                                        />
                                    )}
                                    {item.actualAmount !== undefined && Math.round(item.actualAmount) !== Math.round(item.amount) && (() => {
                                        const variance = item.actualAmount - item.amount;
                                        const over = variance > 0;
                                        return (
                                            <span
                                                className={`text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${over
                                                    ? "bg-destructive/10 text-destructive"
                                                    : "bg-success/10 text-success"
                                                    }`}
                                                title={`Actual: ${Math.round(item.actualAmount)} ${currency}`}
                                            >
                                                {over ? "+" : "−"}{Math.abs(Math.round(variance))} {currency}
                                            </span>
                                        );
                                    })()}
                                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                                </div>
                            </RowItem>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface AllTabBlockViewProps {
    expenses: ExpenseItem[];
    subscriptions: { id: string; name: string; amount: number; billing_cycle: string; category?: string; total_amount?: number; isDue?: boolean }[];
    insurances: { id: string; name: string; monthly_cost: number; total_amount: number; payment_frequency: string; category?: string }[];
    subscriptionsTotal: number;
    insuranceTotal: number;
    currency: string;
    subscriptionSeverity?: 'default' | 'upcoming' | 'warning' | 'danger';
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

        // Get category info for icon
        const catInfo = subscriptionCategories.find(c => c.value === sub.category);

        return {
            id: sub.id,
            name: sub.name,
            amount: sub.billing_cycle === 'yearly' ? parseFloat(sub.amount.toString()) / 12 : parseFloat(sub.amount.toString()),
            category: sub.category, // Pass through for icon lookup
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
            category: ins.category, // Insurance category for icon lookup
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
                    icon={<Home className="h-5 w-5 text-info" />}
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
                    icon={<Repeat className="h-5 w-5 text-accent-purple" />}
                    items={subscriptionItems}
                    categoryType="subscription"
                    onItemClick={onSubscriptionClick}
                    severity={subscriptionSeverity}
                    severityMessage={
                        subscriptionSeverity === 'danger'
                            ? "A yearly subscription is due this month!"
                            : subscriptionSeverity === 'upcoming'
                                ? "A yearly subscription is due next month"
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
                    icon={<Shield className="h-5 w-5 text-warning" />}
                    items={insuranceItems}
                    categoryType="insurance"
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

        </div>
    );
};
