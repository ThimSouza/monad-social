import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-soft",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/92 shadow-card",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline:
          "border border-border/80 bg-secondary/40 shadow-none hover:bg-secondary/70 hover:border-border backdrop-blur-sm",
        secondary: "bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80",
        ghost: "shadow-none hover:bg-muted/80 hover:text-foreground",
        link: "shadow-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-6 py-3",
        sm: "min-h-9 rounded-xl px-4 py-2 text-xs",
        lg: "min-h-12 rounded-2xl px-8 py-3.5 text-base",
        icon: "h-11 w-11 rounded-2xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
