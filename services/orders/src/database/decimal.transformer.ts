import { ValueTransformer } from 'typeorm';

/** PostgreSQL returns DECIMAL columns as strings; expose them as numbers. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) =>
    value === null || value === undefined ? value : Number(value),
};
