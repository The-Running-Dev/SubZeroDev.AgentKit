import { parseArgs } from 'node:util';
import type { ParseArgsConfig } from 'node:util';

export function parseOptions<T extends NonNullable<ParseArgsConfig['options']>>(
  options: T, args = process.argv.slice(2),
) {
  return parseArgs({ options, args, strict: true, allowPositionals: false }).values;
}

export function integerOption(value: string | undefined, name: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || !/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`--${name} requires an integer.`);
  }
  return Number(value);
}

export function requiredOption(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`--${name} is required.`);
  return value;
}
