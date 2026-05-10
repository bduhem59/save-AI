import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-indigo-100 text-indigo-700",
        variant === "secondary" && "bg-gray-100 text-gray-600",
        variant === "outline" && "border border-gray-200 text-gray-500",
        className
      )}
      {...props}
    />
  );
}
