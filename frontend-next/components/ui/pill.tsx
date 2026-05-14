import { cn } from "@/lib/utils";

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "muted" | "outline";
}

export function Pill({ className, variant = "default", ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-ink-100 text-ink-700",
        variant === "muted"   && "bg-ink-50  text-ink-500",
        variant === "outline" && "border border-ink-200 text-ink-600",
        className
      )}
      {...props}
    />
  );
}
