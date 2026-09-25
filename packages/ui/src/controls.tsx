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
import dayjs from 'dayjs';
import { Children, isValidElement, useState, type ComponentProps, type ReactNode } from 'react';

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
export const SearchInput = Input.Search;

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
  const format = showTime ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DD';
  const toDay = (raw?: string) => (raw ? dayjs(raw) : null);
  const initial = value ?? defaultValue ?? '';
  const [current, setCurrent] = useState(initial);
  const dateStringOf = (dateString: string | string[] | null) => {
    if (!dateString) return '';
    return Array.isArray(dateString) ? (dateString[0] ?? '') : dateString;
  };
  return (
    <DatePicker
      id={id}
      disabled={disabled}
      data-testid={testId}
      showTime={showTime}
      format={format}
      value={value !== undefined ? toDay(value) : undefined}
      defaultValue={value === undefined ? toDay(defaultValue) : undefined}
      onChange={(_, dateString) => {
        const next = dateStringOf(dateString);
        setCurrent(next);
        onChange?.({ target: { value: next } });
      }}
      onBlur={() => onBlur?.({ target: { value: value ?? current } })}
    />
  );
}

type ChangeEventLike = { target: { value: string; checked?: boolean } };
type CheckEvent = { target: { value: string; checked: boolean } };

function optionNodes(children: ReactNode): Array<{ value: string; label: ReactNode }> {
  const options: Array<{ value: string; label: ReactNode }> = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child)) return;
    if (typeof child.type === 'string' && child.type !== 'option') return;
    if (child.type !== 'option') return;
    options.push({
      value: String(child.props.value ?? ''),
      label: child.props.children,
    });
  });
  return options;
}

/** Native `<select>` shape backed by Ant Design Select. */
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
    <Select
      id={id}
      aria-label={ariaLabel}
      data-testid={testId}
      disabled={disabled}
      status={status}
      value={value}
      options={optionNodes(children)}
      popupMatchSelectWidth={false}
      onChange={(next) => onChange?.({ target: { value: String(next) } })}
    />
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
}: {
  checked?: boolean;
  onChange?: (event: CheckEvent) => void;
  children?: ReactNode;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <Checkbox
      id={id}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value, checked: event.target.checked } })
      }
    >
      {children}
    </Checkbox>
  );
}
