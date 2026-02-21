import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { Spinner } from "./spinner";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm dark:bg-indigo-600 dark:hover:bg-indigo-500",
  secondary:
    "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100",
  outline:
    "border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 dark:text-gray-100",
  ghost:
    "bg-transparent hover:bg-gray-100 text-gray-900 dark:hover:bg-gray-800 dark:text-gray-100",
  danger:
    "bg-red-600 hover:bg-red-700 text-white shadow-sm dark:bg-red-600 dark:hover:bg-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <Spinner size="sm" className="shrink-0" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
