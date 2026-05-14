import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950/30 disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "default"   && "bg-ink-950 text-white hover:bg-ink-800",
        variant === "secondary" && "bg-ink-100 text-ink-800 hover:bg-ink-200",
        variant === "ghost"     && "text-ink-600 hover:bg-ink-100",
        variant === "outline"   && "border border-ink-200 text-ink-700 hover:bg-ink-50",
        size === "sm" && "h-7 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "lg" && "h-10 px-6 text-base",
        className
      )}
      {...props}
    />
  );
}
