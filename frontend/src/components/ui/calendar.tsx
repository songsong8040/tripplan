"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ko}
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between px-1",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "z-10 h-8 w-8"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "z-10 h-8 w-8"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-10 text-center text-[0.75rem] font-normal text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative h-10 w-10 p-0 text-center text-sm",
        day_button:
          "h-10 w-10 rounded-xl font-normal transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        range_start: "rounded-l-xl bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        range_end: "rounded-r-xl bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        range_middle: "rounded-none bg-secondary [&>button]:rounded-none [&>button]:!bg-transparent [&>button]:!text-foreground",
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground",
        today: "[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
