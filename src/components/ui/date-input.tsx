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
    let input = e.target.value.replace(/[^\d-]/g, "");
    
    // Progressive masking
    if (input.length <= 4) {
      // Just year
      setInputValue(input);
    } else if (input.length <= 7) {
      // Year + month
      const year = input.slice(0, 4);
      const month = input.slice(4).replace(/-/g, "");
      if (month) {
        setInputValue(`${year}-${month}`);
      } else {
        setInputValue(year);
      }
    } else {
      // Full date
      const year = input.slice(0, 4);
      const month = input.slice(4, 6).replace(/-/g, "");
      const day = input.slice(6, 8).replace(/-/g, "");
      
      let formatted = year;
      if (month) formatted += `-${month}`;
      if (day) formatted += `-${day}`;
      
      setInputValue(formatted);
      
      // Try to parse complete date
      if (year.length === 4 && month.length === 2 && day.length === 2) {
        const parsed = new Date(`${year}-${month}-${day}`);
        if (!isNaN(parsed.getTime())) {
          onChange(parsed);
        }
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
