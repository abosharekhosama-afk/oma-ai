#!/usr/bin/env node
/**
 * Replace native button/input/select/textarea controls with @oma/ui adapters.
 * Skips spreads, file inputs, and dynamic className expressions.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const SKIP = new Set(['packages/ui/src/controls.tsx']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (path.endsWith('.tsx')) acc.push(path);
  }
  return acc;
}

function findTagEnd(source, start) {
  let quote = '';
  let brace = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') brace++;
    else if (ch === '}') brace = Math.max(0, brace - 1);
    else if (ch === '>' && brace === 0) return i + 1;
  }
  return -1;
}

function findClose(source, from, tag) {
  let depth = 1;
  let i = from;
  while (i < source.length) {
    const nextOpen = source.indexOf(`<${tag}`, i);
    const nextClose = source.indexOf(`</${tag}`, i);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      const end = findTagEnd(source, nextOpen);
      if (end < 0) return null;
      const open = source.slice(nextOpen, end);
      if (!open.endsWith('/>')) depth++;
      i = end;
      continue;
    }
    const end = source.indexOf('>', nextClose);
    if (end < 0) return null;
    depth--;
    if (depth === 0) return { start: nextClose, end: end + 1 };
    i = end + 1;
  }
  return null;
}

function parseAttrs(raw) {
  const body = raw.replace(/^<[a-zA-Z]+/, '').replace(/\/?>$/, '');
  if (body.includes('{...')) return null;
  const attrs = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    const name = body.slice(i).match(/^[A-Za-z_:][\w:.-]*/);
    if (!name) return null;
    i += name[0].length;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '=') {
      attrs.push([name[0], 'true']);
      continue;
    }
    i++;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] === '"' || body[i] === "'") {
      const q = body[i];
      const end = body.indexOf(q, i + 1);
      if (end < 0) return null;
      attrs.push([name[0], body.slice(i, end + 1)]);
      i = end + 1;
      continue;
    }
    if (body[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < body.length; i++) {
        if (body[i] === '{') depth++;
        else if (body[i] === '}') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      attrs.push([name[0], body.slice(start, i)]);
      continue;
    }
    return null;
  }
  return attrs;
}

function attrValue(attrs, name) {
  const found = attrs.find(([key]) => key === name);
  return found ? found[1] : null;
}

function stringAttr(value) {
  if (!value) return null;
  const match = value.match(/^["']([\s\S]*)["']$/);
  return match ? match[1] : null;
}

function keep(attrs, names) {
  return attrs.filter(
    ([name]) => names.includes(name) || name.startsWith('aria-') || name.startsWith('data-'),
  );
}

function render(name, attrs) {
  const body = attrs
    .filter(([, value]) => value !== null)
    .map(([key, value]) => (value === 'true' ? key : `${key}=${value}`))
    .join(' ');
  return body ? `<${name} ${body}>` : `<${name}>`;
}

function buttonVariant(className) {
  if (!className) return { type: '"default"', extra: [] };
  const classes = className.split(/\s+/);
  const extra = classes.filter(
    (name) =>
      !name.startsWith('oma-btn') &&
      name !== 'oma-icon-btn' &&
      name !== 'oma-link-btn' &&
      name !== 'oma-card-button',
  );
  if (classes.includes('oma-icon-btn') || classes.includes('oma-btn--ghost')) {
    return { type: '"text"', extra };
  }
  if (classes.includes('oma-link-btn')) return { type: '"link"', extra };
  if (classes.some((name) => name.includes('danger')))
    return { type: '"primary"', danger: true, extra };
  if (classes.some((name) => name.includes('secondary'))) return { type: '"default"', extra };
  if (classes.some((name) => name.startsWith('oma-btn'))) return { type: '"primary"', extra };
  return { type: '"default"', extra };
}

function rewriteOpen(tagName, raw) {
  const selfClosing = raw.endsWith('/>');
  const attrs = parseAttrs(raw);
  if (!attrs) return null;
  const className = stringAttr(attrValue(attrs, 'className'));
  if (attrValue(attrs, 'className') && className === null) return null;
  const type = stringAttr(attrValue(attrs, 'type'));

  if (tagName === 'input' && (type === 'hidden' || type === 'file')) return null;

  if (tagName === 'button') {
    const variant = buttonVariant(className);
    const next = keep(attrs, [
      'id',
      'disabled',
      'onClick',
      'onPointerDown',
      'onKeyDown',
      'title',
      'name',
      'form',
      'autoFocus',
    ]);
    next.unshift(['type', variant.type]);
    if (variant.danger) next.push(['danger', 'true']);
    if (type && type !== 'button') next.push(['htmlType', `"${type}"`]);
    if (variant.extra.length) next.push(['className', `"${variant.extra.join(' ')}"`]);
    return { component: 'Button', open: render('Button', next), selfClosing, close: 'Button' };
  }

  if (tagName === 'textarea') {
    const next = keep(attrs, [
      'id',
      'name',
      'value',
      'defaultValue',
      'onChange',
      'onBlur',
      'disabled',
      'required',
      'placeholder',
      'rows',
      'maxLength',
      'readOnly',
      'autoFocus',
    ]);
    return {
      component: 'TextArea',
      open: render('TextArea', next),
      selfClosing,
      close: 'TextArea',
    };
  }

  if (tagName === 'select') {
    const next = keep(attrs, ['id', 'value', 'onChange', 'disabled', 'name']);
    return {
      component: 'SelectField',
      open: render('SelectField', next),
      selfClosing,
      close: 'SelectField',
    };
  }

  if (tagName === 'input' && type === 'checkbox') {
    const next = keep(attrs, ['id', 'checked', 'onChange', 'disabled', 'name']);
    return {
      component: 'CheckboxField',
      open: render('CheckboxField', next).replace(/>$/, ' />'),
      selfClosing: true,
      close: null,
    };
  }

  if (tagName === 'input' && (type === 'date' || type === 'datetime-local')) {
    const next = keep(attrs, ['id', 'value', 'defaultValue', 'onChange', 'disabled', 'name']);
    if (type === 'datetime-local') next.push(['showTime', 'true']);
    return {
      component: 'DateField',
      open: render('DateField', next).replace(/>$/, ' />'),
      selfClosing: true,
      close: null,
    };
  }

  if (tagName === 'input' && (type === 'radio' || type === 'time')) {
    return null;
  }

  if (tagName === 'input') {
    const component =
      type === 'password' ? 'PasswordInput' : type === 'search' ? 'SearchInput' : 'Input';
    const next = keep(attrs, [
      'id',
      'name',
      'value',
      'defaultValue',
      'onChange',
      'onBlur',
      'disabled',
      'required',
      'placeholder',
      'autoComplete',
      'autoFocus',
      'inputMode',
      'maxLength',
      'readOnly',
      'min',
      'max',
      'step',
    ]);
    if (type && !['password', 'search', 'text'].includes(type)) next.push(['type', `"${type}"`]);
    return {
      component,
      open: render(component, next).replace(/>$/, ' />'),
      selfClosing: true,
      close: null,
    };
  }
  return null;
}

function ensureImport(source, components) {
  if (components.size === 0) return source;
  const names = [...components].sort();
  const line = `import { ${names.join(', ')} } from '@oma/ui/controls';\n`;
  const existing = source.match(/import \{([^}]+)\} from '@oma\/ui\/controls';/);
  if (!existing) {
    const useClient = source.startsWith("'use client'") || source.startsWith('"use client"');
    if (!useClient) return `'use client';\n${line}${source}`;
    const end = source.indexOf('\n');
    return `${source.slice(0, end + 1)}${line}${source.slice(end + 1)}`;
  }
  const current = existing[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const merged = [...new Set([...current, ...names])].sort();
  return source.replace(existing[0], `import { ${merged.join(', ')} } from '@oma/ui/controls';`);
}

let filesChanged = 0;
let converted = 0;
let skipped = 0;

for (const file of walk(join(ROOT, 'apps/web/src'))) {
  const rel = relative(ROOT, file);
  if (SKIP.has(rel)) continue;
  let source = readFileSync(file, 'utf8');
  const edits = [];
  const used = new Set();
  let i = 0;
  while (i < source.length) {
    const match = source.slice(i).match(/^<(button|input|select|textarea)\b/);
    if (!match) {
      i++;
      continue;
    }
    const start = i;
    const tag = match[1];
    const end = findTagEnd(source, start);
    if (end < 0) break;
    const raw = source.slice(start, end);
    const next = rewriteOpen(tag, raw);
    if (!next) {
      skipped++;
      if (process.argv.includes('--verbose')) {
        console.log(
          'skip',
          rel,
          source.slice(start, Math.min(end, start + 120)).replace(/\s+/g, ' '),
        );
      }
      i = end;
      continue;
    }
    let close = null;
    if (!next.selfClosing) {
      close = findClose(source, end, tag);
      if (!close) {
        skipped++;
        i = end;
        continue;
      }
    }
    const component = next.open.match(/^<([A-Za-z]+)/)[1];
    edits.push({ start, end, text: next.open });
    if (close) edits.push({ start: close.start, end: close.end, text: `</${component}>` });
    used.add(next.component);
    converted++;
    i = end;
  }
  if (edits.length === 0) continue;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  source = ensureImport(source, used);
  filesChanged++;
  if (!DRY) writeFileSync(file, source);
}

console.log(JSON.stringify({ filesChanged, converted, skipped, dry: DRY }));
