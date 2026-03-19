import { cn } from "@/lib/utils";

export function ResponsiveTable({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0", className)} {...props}>
      {children}
    </div>
  );
}
