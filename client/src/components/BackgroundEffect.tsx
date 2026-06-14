import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/ThemeContext";

export function BackgroundEffect() {
  const { backgroundEffect } = useTheme();

  if (backgroundEffect === "none") return null;

  return createPortal(
    <div
      className={`bg-effect-${backgroundEffect}`}
      aria-hidden="true"
    />,
    document.body
  );
}
