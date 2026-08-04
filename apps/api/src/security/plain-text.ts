import { Transform } from 'class-transformer';

const UNSAFE_CONTROLS =
  // eslint-disable-next-line no-control-regex -- these are the characters removed.
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

export function normalizePlainText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(UNSAFE_CONTROLS, '');
}

export function PlainText() {
  return Transform(({ value }) => normalizePlainText(value));
}
