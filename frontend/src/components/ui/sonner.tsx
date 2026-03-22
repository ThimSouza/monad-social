import * as React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:bg-card group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:text-foreground group-[.toaster]:shadow-lift",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:rounded-xl group-[.toast]:bg-primary group-[.toast]:px-4 group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-xl group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast } from "sonner";
