import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthChip } from "@/components/ui/month-chip";
import { format } from "date-fns";
import {
    getFinancialMonthRange,
    getCurrentFinancialMonth,
} from "@/utils/dateUtils";

interface MonthPickerPopoverProps {
    selectedMonth: string;
    financialMonthStart: number;
    onSelect: (monthKey: string) => void;
}

const monthAbbrev = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MonthPickerPopover = ({
    selectedMonth,
    financialMonthStart,
    onSelect,
}: MonthPickerPopoverProps) => {
    const selectedEnd = getFinancialMonthRange(selectedMonth, financialMonthStart).end;
    const selectedLabel = format(selectedEnd, "MMM yyyy");
    const todayMonth = getCurrentFinancialMonth(financialMonthStart);
    const todayEnd = getFinancialMonthRange(todayMonth, financialMonthStart).end;

    const [open, setOpen] = useState(false);
    const [year, setYear] = useState(selectedEnd.getFullYear());

    const monthKeyFor = (calendarYear: number, calendarMonthIdx: number): string => {
        const ref = new Date(calendarYear, calendarMonthIdx, 15);
        return format(getFinancialMonthRange(ref, financialMonthStart).start, "yyyy-MM-dd");
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <MonthChip value={selectedLabel} />
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="end">
                <div className="flex items-center justify-between mb-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setYear((y) => y - 1)}
                        aria-label="Previous year"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold">{year}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setYear((y) => y + 1)}
                        aria-label="Next year"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {monthAbbrev.map((label, idx) => {
                        const key = monthKeyFor(year, idx);
                        const isSelected = key === selectedMonth;
                        const isToday = key === todayMonth;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    onSelect(key);
                                    setOpen(false);
                                }}
                                className={[
                                    "h-9 rounded-md text-sm font-medium transition-colors",
                                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                    isSelected
                                        ? "bg-accent text-accent-ink"
                                        : "hover:bg-surface-2 text-ink",
                                    isToday && !isSelected ? "border border-accent" : "",
                                ].join(" ")}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
                {selectedMonth !== todayMonth && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-3 justify-center"
                        onClick={() => {
                            onSelect(todayMonth);
                            setYear(todayEnd.getFullYear());
                            setOpen(false);
                        }}
                    >
                        Jump to {format(todayEnd, "MMM yyyy")}
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
};
