import { CSS } from "@cocalc/frontend/app-framework";
import { COLORS } from "@cocalc/util/theme";

export const CODE_BAR_BTN_STYLE: CSS = {
  fontSize: "12px",
  color: COLORS.GRAY_M,
} as const;

export const MINI_BUTTONS_STYLE: CSS = {
  position: "absolute",
  right: "2px",
  top: "-22px",
} as const;

export const MINI_BUTTONS_STYLE_INNER: CSS = {
  display: "flex",
  gap: "3px",
  alignItems: "flex-start",
  ...CODE_BAR_BTN_STYLE,
  borderTop: `1px solid ${COLORS.GRAY_L}`,
  borderLeft: `1px solid ${COLORS.GRAY_L}`,
  borderRight: `1px solid ${COLORS.GRAY_L}`,
  borderRadius: "3px 3px 3px 0",
} as const;
