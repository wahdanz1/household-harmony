import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ArrowRight, Sparkles, Shield, Calculator, FileText, TrendingUp, LucideIcon } from "lucide-react";

interface TourStep {
    id: string;
    title: string;
    content: string;
    icon: LucideIcon;
}

const tourSteps: TourStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Household Harmony',
        content: 'A Swedish household budgeting app built with privacy-first encryption. I created this to solve the problem of tracking shared expenses, Swedish tax calculations, and co-parent finances - all while keeping your data completely private through client-side encryption. Try all features - data resets when you leave.',
        icon: Sparkles
    },
    {
        id: 'encryption',
        title: 'Client-Side Encryption',
        content: 'All financial data is encrypted with AES-256-GCM in your browser before being stored. Click "Show Encrypted Data" buttons to see the real ciphertext stored in the database.',
        icon: Shield
    },
    {
        id: 'swedish-tax',
        title: 'Swedish Tax Calculations',
        content: 'Progressive tax calculations (32% up to 523,200 SEK, 52% above). Configurable per income source - set your own tax percentage when adding income.',
        icon: Calculator
    },
    {
        id: 'ai-parsing',
        title: 'AI Invoice Parsing',
        content: 'Upload PDF invoices to auto-extract transactions. Uses your own API key (Gemini/Groq) - configure in Settings. No API costs for us, full control for you.',
        icon: FileText
    },
    {
        id: 'smart-defaults',
        title: 'Smart Defaults',
        content: 'Variable expenses show 3-month averages, static expenses remember last month. The system learns your patterns to reduce manual entry.',
        icon: TrendingUp
    }
];

export const GuidedTour = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [active, setActive] = useState(
        localStorage.getItem('demo_tour_active') === 'true'
    );

    const isDemoMode = localStorage.getItem('is_demo_mode') === 'true';

    // Don't show if not demo mode
    if (!isDemoMode || !active) return null;

    const step = tourSteps[currentStep];
    const StepIcon = step.icon;

    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            closeTour();
        }
    };

    const handleSkip = () => {
        closeTour();
    };

    const closeTour = () => {
        setActive(false);
        localStorage.setItem('demo_tour_active', 'false');
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <Card className="w-full max-w-lg border-2 border-primary/20 shadow-2xl">
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <StepIcon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold">{step.title}</h3>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={handleSkip}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {step.content}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex gap-1">
                                {tourSteps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all ${idx === currentStep
                                            ? 'w-8 bg-primary'
                                            : idx < currentStep
                                                ? 'w-1.5 bg-primary/50'
                                                : 'w-1.5 bg-muted'
                                            }`}
                                    />
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSkip}
                                >
                                    Skip Tour
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleNext}
                                >
                                    {currentStep < tourSteps.length - 1 ? (
                                        <>
                                            Next
                                            <ArrowRight className="ml-1.5 h-3 w-3" />
                                        </>
                                    ) : (
                                        'Start Exploring'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
