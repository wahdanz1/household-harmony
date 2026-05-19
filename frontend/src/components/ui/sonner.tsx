/* eslint-disable react-refresh/only-export-components */
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-bg group-[.toaster]:text-ink group-[.toaster]:border-line group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted",
          actionButton: "group-[.toast]:bg-accent group-[.toast]:text-accent-ink",
          cancelButton: "group-[.toast]:bg-surface-2 group-[.toast]:text-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
