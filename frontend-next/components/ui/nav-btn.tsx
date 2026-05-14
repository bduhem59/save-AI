import { cn } from "@/lib/utils";

interface NavBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
  count?: number;
}

export function NavBtn({ active, icon, label, count, className, ...props }: NavBtnProps) {
  return (
    <button
      className={cn(
        "group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-white text-ink-950 shadow-soft"
          : "text-ink-600 hover:text-ink-900 hover:bg-ink-100/70",
        className
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 w-4 h-4 flex items-center justify-center">
          {icon}
        </span>
      )}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className={cn("text-xs tabular-nums", active ? "text-ink-500" : "text-ink-400 group-hover:text-ink-500")}>
          {count}
        </span>
      )}
    </button>
  );
}
