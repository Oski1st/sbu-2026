type FocusableControl = { disabled: boolean; focus: () => void };

/** Called after React applies disabled attributes; don't steal focus from elsewhere. */
export function restoreJourneyControlFocus(
  focused: FocusableControl | null,
  activeElement: unknown,
  body: unknown,
  controls: readonly (FocusableControl | null)[],
) {
  if (!focused?.disabled || (activeElement !== focused && activeElement !== body)) return;
  controls.find((control) => control && !control.disabled)?.focus();
}
