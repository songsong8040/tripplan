import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[0.9375rem] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-ink-800",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50",
        secondary: "bg-ink-100 text-ink-800 hover:bg-ink-200",
        ghost: "hover:bg-ink-100",
        soft: "bg-lilac-100 text-lilac-700 ring-1 ring-inset ring-lilac-200 hover:bg-lilac-200",
        mint: "bg-mint-100 text-mint-700 ring-1 ring-inset ring-mint-200 hover:bg-mint-200",
        peach: "bg-peach-100 text-peach-700 ring-1 ring-inset ring-peach-200 hover:bg-peach-200",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-[10px] px-3.5 text-[0.8125rem]",
        lg: "h-14 rounded-2xl px-7 text-base",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
