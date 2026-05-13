import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ArrowRight, Sparkles, Shield, TrendingUp, Home, Users, LucideIcon } from "lucide-react";

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
        content: 'A Swedish household budgeting app built with privacy-first encryption. Track income, expenses, subscriptions, and savings goals for single or multi-user households. Perfect for families managing shared finances and co-parent expenses. All your financial data stays completely private through client-side encryption. Try all features - this demo resets when you leave.',
        icon: Sparkles
    },
    {
        id: 'encryption',
        title: 'Client-Side Encryption',
        content: 'All sensitive data is encrypted with AES-256-GCM in your browser before reaching the server. Click the eye icons next to income and expenses to see the actual encrypted ciphertext stored in the database. Only you (and household members you invite) can decrypt your financial information. Even we can\'t read it.',
        icon: Shield
    },
    {
        id: 'multi-user',
        title: 'Multi-User Households',
        content: 'Invite family members to collaborate on shared finances. Perfect for couples managing joint expenses, co-parents tracking shared costs, or families splitting bills. Each member gets their own encrypted vault. You control who sees what.',
        icon: Users
    },
    {
        id: 'smart-budgeting',
        title: 'Smart Budgeting Features',
        content: 'The app learns your spending patterns. Smart Defaults show 3-month averages for variable expenses. Swedish Financial Months use 25th-24th cycle (standard in Sweden). Never forget recurring costs with Subscription Tracking. Reduces manual entry while keeping you in control.',
        icon: TrendingUp
    },
    {
        id: 'coming-soon',
        title: 'Coming Soon: AI & Automation',
        content: 'Features in development: AI Invoice Parsing for auto-extraction (currently beta for credit cards), Swedish Tax Intelligence with progressive tax calculations (32%/52%), and Bank Import via CSV/Excel wizard. This demo shows current stable features. Check Settings for experimental tools.',
        icon: Sparkles
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
        <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <Card className="w-full max-w-lg border-2 border-accent/20 shadow-2xl">
                <CardContent className="pt-6">
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-accent/10">
                                    <StepIcon className="h-5 w-5 text-accent" />
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

                        <p className="text-sm text-muted leading-relaxed">
                            {step.content}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex gap-1">
                                {tourSteps.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all ${idx === currentStep
                                            ? 'w-8 bg-accent'
                                            : idx < currentStep
                                                ? 'w-1.5 bg-accent/50'
                                                : 'w-1.5 bg-surface-2'
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
