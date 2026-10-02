import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-2xl transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium border border-transparent bg-ink-100 px-4 py-2 text-base placeholder:text-ink-400 focus-visible:border-ink-900 focus-visible:bg-white focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
