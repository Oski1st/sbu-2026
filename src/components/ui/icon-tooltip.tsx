import { lazy, Suspense, type ReactElement } from "react";

// Radix Tooltip (with its positioning engine) is ~29 kB gzip, so it is split out of the
// main bundle. Until the chunk arrives the control renders on its own; the tooltip is a
// visual hint only — the wrapped control keeps its own aria-label.
const LoadedTooltip = lazy(async () => {
  const { Tooltip, TooltipContent, TooltipTrigger } = await import("./tooltip");
  return {
    default: function LoadedTooltip({ label, side, children }: IconTooltipProps) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side={side}>{label}</TooltipContent>
        </Tooltip>
      );
    },
  };
});

type IconTooltipProps = {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
};

export function IconTooltip(props: IconTooltipProps) {
  return (
    <Suspense fallback={props.children}>
      <LoadedTooltip {...props} />
    </Suspense>
  );
}
