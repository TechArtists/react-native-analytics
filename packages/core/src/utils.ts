export const trimString = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

export const toISODate = (date: Date) => date.toISOString().slice(0, 10);

export const stringifyOptional = (value: unknown) =>
  value === undefined || value === null ? '' : `${value}`;
