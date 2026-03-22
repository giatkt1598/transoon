export type SortDirection = "asc" | "desc";

type SortSelector<T> = keyof T | ((item: T) => unknown);

export function orderBy<T>(items: T[], selector: SortSelector<T>) {
  return orderByCore(items, selector, "asc");
}

export function orderByDescending<T>(items: T[], selector: SortSelector<T>) {
  return orderByCore(items, selector, "desc");
}

function orderByCore<T>(
  items: T[],
  selector: SortSelector<T>,
  direction: SortDirection,
) {
  const resolveValue =
    typeof selector === "function"
      ? selector
      : (item: T) => item[selector];

  return items
    .map((item, index) => ({
      item,
      index,
      value: normalizeSortValue(resolveValue(item)),
    }))
    .sort((left, right) => {
      const leftValue = left.value;
      const rightValue = right.value;

      if (leftValue === rightValue) {
        return left.index - right.index;
      }

      if (leftValue === null) {
        return direction === "asc" ? -1 : 1;
      }

      if (rightValue === null) {
        return direction === "asc" ? 1 : -1;
      }

      if (leftValue < rightValue) {
        return direction === "asc" ? -1 : 1;
      }

      return direction === "asc" ? 1 : -1;
    })
    .map((entry) => entry.item);
}

function normalizeSortValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return String(value).toLocaleLowerCase();
}
