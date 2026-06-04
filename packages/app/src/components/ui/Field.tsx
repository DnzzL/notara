import type { ReactNode } from "react";

export interface FieldProps {
  label: ReactNode;
  /** id of the control this label points at. */
  htmlFor: string;
  /** Optional element shown next to the label (e.g. a "Forgot password?" link). */
  accessory?: ReactNode;
  /** The form control — usually an <input>. */
  children: ReactNode;
}

/** Label + control wrapper for the auth/form layout (`.auth-field`). */
export function Field({ label, htmlFor, accessory, children }: FieldProps) {
  return (
    <div className="auth-field">
      {accessory ? (
        <div className="auth-field-header">
          <label htmlFor={htmlFor}>{label}</label>
          {accessory}
        </div>
      ) : (
        <label htmlFor={htmlFor}>{label}</label>
      )}
      {children}
    </div>
  );
}
