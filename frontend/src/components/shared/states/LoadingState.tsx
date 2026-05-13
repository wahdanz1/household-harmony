import { Loader2 } from "lucide-react";

interface LoadingStateProps {
    message?: string;
}

export const LoadingState = ({ message = "Loading..." }: LoadingStateProps) => {
    return (
        <div className="loading-container">
            <div className="text-center">
                <Loader2 className="loading-spinner" />
                <p className="text-muted mt-2">{message}</p>
            </div>
        </div>
    );
};
