// Adapted from shadcn/ui's Sonner wrapper (MIT, https://ui.shadcn.com) for sonner (MIT).
// No next-themes: OneLine ships one light theme. Sonner's region is aria-live="polite"
// and its own stylesheet disables toast motion under prefers-reduced-motion.
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      containerAriaLabel="Notifications"
      toastOptions={{
        classNames: {
          toast: "ui-toast",
          title: "ui-toast-title",
          description: "ui-toast-description",
        },
      }}
      style={
        {
          "--normal-bg": "var(--color-neutral)",
          "--normal-text": "var(--color-neutral-content)",
          "--normal-border": "var(--color-neutral)",
          "--border-radius": "var(--radius-box)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
