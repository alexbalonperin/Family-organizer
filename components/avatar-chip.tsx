import { cn } from "@/lib/utils";

interface Props {
  displayName: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

// Renders an initial-only avatar swatch in the user's chosen palette color.
// Used in calendar chips, completion attribution, dashboard, family list.
export function AvatarChip({
  displayName,
  color,
  size = "sm",
  className,
}: Props) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-label={displayName}
      title={displayName}
    >
      {initials || "?"}
    </span>
  );
}
