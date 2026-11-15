'use client';

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  App,
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Menu,
  Modal,
  Popover,
  Radio,
  Result,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  Upload,
  Alert,
  Pagination,
  Spin,
  Breadcrumb,
  type ButtonProps,
  type SelectProps,
} from 'antd';

export {
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Menu,
  Modal,
  Popover,
  Radio,
  Result,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
  Upload,
  Alert,
  Pagination,
  Spin,
  Breadcrumb,
};

export type { ButtonProps, SelectProps };

export const TextArea = Input.TextArea;

export function IconButton({ label, ...props }: ButtonProps & { label: string }) {
  return <Button type="text" aria-label={label} {...props} />;
}

/**
 * Content-surface press target (cards, list rows, feed items, calendar tiles).
 * Uses a native button so Ant Design controlHeight does not clip media or multi-line rows.
 */
export function SurfaceButton({
  className,
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  );
}

export function OmaSelect({
  value,
  onChange,
  options,
  disabled,
  testId,
  status,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
  testId?: string;
  status?: SelectProps['status'];
  id?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      status={status}
      data-testid={testId}
      popupMatchSelectWidth={false}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        title: option.value,
      }))}
      onChange={(next) => onChange(String(next))}
    />
  );
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Form.Item
      label={label}
      htmlFor={htmlFor}
      help={error ?? help}
      validateStatus={error ? 'error' : undefined}
    >
      {children}
    </Form.Item>
  );
}

export function useOmaFeedback() {
  return App.useApp();
}

export const PasswordInput = Input.Password;

/** Text field without Ant Design's extra search button, so a page Search action stays unique. */
export function SearchInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

export function RangePicker(props: ComponentProps<typeof DatePicker.RangePicker>) {
  return <DatePicker.RangePicker {...props} />;
}

type DateChange = { target: { value: string } };

export function DateField({
  value,
  defaultValue,
  onChange,
  onBlur,
  id,
  disabled,
  showTime,
  'data-testid': testId,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (event: DateChange) => void;
  onBlur?: (event: DateChange) => void;
  id?: string;
  disabled?: boolean;
  showTime?: boolean;
  'data-testid'?: string;
}) {
  return (
    <input
      className="oma-input"
      type={showTime ? 'datetime-local' : 'date'}
      id={id}
      disabled={disabled}
      data-testid={testId}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={(event) => onChange?.({ target: { value: readControlValue(event) } })}
      onBlur={(event) => onBlur?.({ target: { value: readControlValue(event) } })}
    />
  );
}

type ChangeEventLike = { target: { value: string; checked?: boolean } };

function readControlValue(event: { target: unknown }): string {
  const target = event.target as { value?: string } | null;
  return target?.value ?? '';
}
type CheckEvent = { target: { value: string; checked: boolean } };

/** Card-style select (Planable choice card) — replaces native <select>. */
export type MenuPlacement = {
  left: number;
  width: number;
  maxHeight: number;
  /** Fixed `top` when the menu opens downward, else null. */
  top: number | null;
  /** Fixed `bottom` when the menu flips upward, else null. */
  bottom: number | null;
};

/**
 * Viewport-fixed placement for a floating select menu: opens below the trigger, flips above
 * when there is clearly more room there, and is clamped horizontally inside the viewport.
 */
export function computeMenuPlacement(
  rect: { top: number; bottom: number; left: number; width: number },
  viewport: { width: number; height: number },
  contentHeight = 260,
): MenuPlacement {
  const gap = 4;
  const desired = Math.min(260, contentHeight);
  const below = viewport.height - rect.bottom - gap - 8;
  const above = rect.top - gap - 8;
  const openUp = below < Math.min(desired, 160) && above > below;
  const maxHeight = Math.max(120, Math.min(260, openUp ? above : below));
  const width = Math.min(Math.max(rect.width, 160), Math.max(160, viewport.width - 16));
  const left = Math.min(Math.max(8, rect.left), Math.max(8, viewport.width - width - 8));
  return openUp
    ? { left, width, maxHeight, top: null, bottom: viewport.height - rect.top + gap }
    : { left, width, maxHeight, top: rect.bottom + gap, bottom: null };
}

export function SelectField({
  value,
  onChange,
  children,
  disabled,
  id,
  status,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: {
  value?: string;
  onChange?: (event: ChangeEventLike) => void;
  children?: ReactNode;
  disabled?: boolean;
  id?: string;
  status?: SelectProps['status'];
  'aria-label'?: string;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const options = useMemo(() => {
    const list: Array<{ value: string; label: string; disabled?: boolean }> = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      };
      const optValue = props.value != null ? String(props.value) : '';
      const label =
        typeof props.children === 'string' || typeof props.children === 'number'
          ? String(props.children)
          : optValue;
      list.push({ value: optValue, label, disabled: props.disabled });
    });
    return list;
  }, [children]);

  const selected = options.find((o) => o.value === value) ?? options[0];
  const display = selected?.label ?? '';

  // The menu is portalled to <body> with fixed coordinates so cards, grids, and
  // `overflow: hidden` containers can never clip it or paint over it.
  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const placement = computeMenuPlacement(
      trigger.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      menuRef.current?.scrollHeight ?? 260,
    );
    setMenuStyle({
      '--oma-menu-left': `${placement.left}px`,
      '--oma-menu-width': `${placement.width}px`,
      '--oma-menu-max-height': `${placement.maxHeight}px`,
      '--oma-menu-top': placement.top == null ? 'auto' : `${placement.top}px`,
      '--oma-menu-bottom': placement.bottom == null ? 'auto' : `${placement.bottom}px`,
    } as CSSProperties);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    placeMenu();
    const onMove = () => placeMenu();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, placeMenu]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (
        e.target instanceof Node &&
        !rootRef.current.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className="oma-choice-select"
      ref={rootRef}
      data-open={open ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-invalid={status === 'error' ? 'true' : undefined}
    >
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className="oma-choice-select__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={status === 'error' || undefined}
        data-testid={testId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className="oma-choice-select__value">{display || '—'}</span>
        <span className="oma-choice-select__caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={menuRef}
              className="oma-choice-select__menu oma-choice-select__menu--floating"
              role="listbox"
              data-testid={testId ? `${testId}-menu` : undefined}
              style={menuStyle ?? { visibility: 'hidden' }}
            >
              {options.map((opt) => (
                <li key={opt.value || '__empty'} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    data-selected={opt.value === value ? 'true' : 'false'}
                    disabled={opt.disabled}
                    className="oma-choice-select__option"
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange?.({ target: { value: opt.value } });
                      setOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    <span className="oma-choice-select__check" aria-hidden>
                      {opt.value === value ? '✓' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
      {/* Keep a hidden native select for form / a11y fallbacks when needed */}
      <select
        className="oma-choice-select__native"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={value}
        onChange={(event) => onChange?.({ target: { value: readControlValue(event) } })}
      >
        {children}
      </select>
    </div>
  );
}

/** Native checkbox event shape backed by Ant Design Checkbox. */
export function CheckboxField({
  checked,
  onChange,
  children,
  disabled,
  id,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: {
  checked?: boolean;
  onChange?: (event: CheckEvent) => void;
  children?: ReactNode;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}) {
  return (
    <label className="oma-checkbox-field">
      <input
        className="oma-checkbox"
        type="checkbox"
        id={id}
        aria-label={ariaLabel}
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(event) =>
          onChange?.({
            target: {
              value: 'on',
              checked: Boolean((event.target as { checked?: boolean }).checked),
            },
          })
        }
      />
      {children}
    </label>
  );
}
