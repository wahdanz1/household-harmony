import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

const STORAGE_KEY = "hh-theme";

const readTheme = (): Theme => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
};

const applyTheme = (theme: Theme) => {
    document.documentElement.setAttribute("data-theme", theme);
};

interface ThemeToggleProps {
    variant?: "ghost" | "outline" | "default";
    size?: "sm" | "default" | "lg";
    showLabel?: boolean;
}

export const ThemeToggle = ({ variant = "outline", size = "default", showLabel = false }: ThemeToggleProps) => {
    const [theme, setTheme] = useState<Theme>(readTheme);

    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // localStorage unavailable (private mode etc.) — theme still applies for the session
        }
    }, [theme]);

    const next = theme === "dark" ? "light" : "dark";
    const Icon = theme === "dark" ? Sun : Moon;
    const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

    return (
        <Button
            variant={variant}
            size={showLabel ? size : "icon"}
            onClick={() => setTheme(next)}
            aria-label={label}
            title={label}
        >
            <Icon className="h-4 w-4" />
            {showLabel && <span className="ml-2">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </Button>
    );
};
