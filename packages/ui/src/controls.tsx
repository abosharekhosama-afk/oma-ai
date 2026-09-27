'use client';

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
import { type ComponentProps, type ReactNode } from 'react';

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

export const TextArea = Input.TextArea;

export function IconButton({ label, ...props }: ButtonProps & { label: string }) {
  return <Button type="text" aria-label={label} {...props} />;
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

/** Native select so existing journeys can choose a value without a second popup widget. */
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
  return (
    <select
      className="oma-select"
      id={id}
      aria-label={ariaLabel}
      aria-invalid={status === 'error' || undefined}
      data-testid={testId}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange?.({ target: { value: readControlValue(event) } })}
    >
      {children}
    </select>
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
