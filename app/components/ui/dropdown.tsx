import {
  type HTMLAttributes,
  type ReactNode,
  type MouseEvent,
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  useContext,
} from "react";
import { cn } from "~/lib/utils";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx)
    throw new Error("Dropdown components must be used within a DropdownMenu");
  return ctx;
}

export interface DropdownMenuProps {
  children: ReactNode;
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps {
  children: ReactNode;
}

export function DropdownTrigger({ children }: DropdownTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdown();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(!open);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-haspopup="menu"
      className="focus-brand-ring"
    >
      {children}
    </div>
  );
}

export interface DropdownContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  children: ReactNode;
}

export function DropdownContent({
  align = "end",
  className,
  children,
  ...props
}: DropdownContentProps) {
  const { open, setOpen } = useDropdown();
  const contentRef = useRef<HTMLDivElement>(null);

  const getMenuItems = useCallback(() => {
    if (!contentRef.current) return [] as HTMLElement[];
    return Array.from(
      contentRef.current.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"])'
      )
    );
  }, []);

  const handleClickOutside = useCallback(
    (e: globalThis.MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    },
    [setOpen]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      getMenuItems()[0]?.focus();
    });
  }, [open, getMenuItems]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getMenuItems();
    if (!items.length) return;

    const currentIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    }

    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    }

    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={contentRef}
      role="menu"
      tabIndex={-1}
      onKeyDown={handleMenuKeyDown}
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-lg",
        "dark:border-gray-800 dark:bg-gray-900",
        "animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DropdownItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  children: ReactNode;
}

export function DropdownItem({
  disabled = false,
  className,
  children,
  onClick,
  ...props
}: DropdownItemProps) {
  const { setOpen } = useDropdown();

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onClick?.(e);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const syntheticEvent = {
        ...event,
        currentTarget: event.currentTarget,
        target: event.target,
      } as unknown as MouseEvent<HTMLDivElement>;
      onClick?.(syntheticEvent);
      setOpen(false);
    }
  };

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={cn(
        "flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm",
        "text-gray-900 dark:text-gray-100",
        "transition-colors duration-150",
        disabled
          ? "pointer-events-none opacity-50"
          : "focus-brand-ring hover:bg-gray-100 dark:hover:bg-gray-800",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownSeparator({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn(
        "-mx-1 my-1 h-px bg-gray-200 dark:bg-gray-800",
        className
      )}
      {...props}
    />
  );
}
