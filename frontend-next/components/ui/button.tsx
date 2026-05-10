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
        "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "default"   && "bg-indigo-600 text-white hover:bg-indigo-700",
        variant === "secondary" && "bg-gray-100 text-gray-800 hover:bg-gray-200",
        variant === "ghost"     && "text-gray-600 hover:bg-gray-100",
        variant === "outline"   && "border border-gray-200 text-gray-700 hover:bg-gray-50",
        size === "sm" && "h-7 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "lg" && "h-10 px-6 text-base",
        className
      )}
      {...props}
    />
  );
}
