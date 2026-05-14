import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default"   && "bg-ink-900 text-white",
        variant === "secondary" && "bg-ink-100 text-ink-700",
        variant === "outline"   && "border border-ink-200 text-ink-600",
        className
      )}
      {...props}
    />
  );
}
