import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateInputProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DateInput({ value, onChange, placeholder = "YYYY-MM-DD", disabled }: DateInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (value) {
      setInputValue(format(value, "yyyy-MM-dd"));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove all non-digit characters to get pure digits
    const digitsOnly = e.target.value.replace(/\D/g, "");
    
    // Limit to 8 digits (YYYYMMDD)
    const digits = digitsOnly.slice(0, 8);
    
    // Build formatted string progressively
    let formatted = "";
    if (digits.length > 0) {
      formatted = digits.slice(0, 4); // Year
    }
    if (digits.length > 4) {
      formatted += `-${digits.slice(4, 6)}`; // Month
    }
    if (digits.length > 6) {
      formatted += `-${digits.slice(6, 8)}`; // Day
    }
    
    setInputValue(formatted);
    
    // Parse complete date
    if (digits.length === 8) {
      const parsed = new Date(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`);
      if (!isNaN(parsed.getTime())) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    if (inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parsed = new Date(inputValue);
      if (!isNaN(parsed.getTime())) {
        onChange(parsed);
      } else {
        setInputValue(value ? format(value, "yyyy-MM-dd") : "");
      }
    } else if (!inputValue) {
      onChange(undefined);
    } else {
      setInputValue(value ? format(value, "yyyy-MM-dd") : "");
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
        maxLength={10}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full px-3"
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
