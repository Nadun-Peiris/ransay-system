const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateInput(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = DATE_ONLY_PATTERN.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

export function parseDateToInput(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = DATE_ONLY_PATTERN.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (!DATE_ONLY_PATTERN.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}
