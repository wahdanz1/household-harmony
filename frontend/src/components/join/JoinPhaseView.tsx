import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const JoinInFlightView = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-10 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">{message}</p>
    </div>
);

interface JoinErrorViewProps {
    message: string;
    onClose: () => void;
    onRetry: () => void;
}

export const JoinErrorView = ({ message, onClose, onRetry }: JoinErrorViewProps) => (
    <>
        <DialogHeader>
            <DialogTitle>Something went wrong</DialogTitle>
            <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={onRetry}>Try again</Button>
        </DialogFooter>
    </>
);
