import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, relativeTo: Date = new Date()) {
  const date = new Date(dateStr);
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const startOfRelative = new Date(
    relativeTo.getFullYear(),
    relativeTo.getMonth(),
    relativeTo.getDate(),
  ).getTime();

  const diffDays = Math.round(
    (startOfRelative - startOfDate) / (1000 * 3600 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function groupNotesByDate<T extends { updatedAt: string }>(
  notes: T[],
  relativeTo: Date = new Date(),
) {
  const groups: Map<number, T[]> = new Map();

  notes.forEach((note) => {
    const date = new Date(note.updatedAt);
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();

    if (!groups.has(dayStart)) {
      groups.set(dayStart, []);
    }
    groups.get(dayStart)!.push(note);
  });

  const sortedDays = Array.from(groups.keys()).sort((a, b) => b - a);

  return sortedDays.map((dayStart) => {
    const label = formatDate(new Date(dayStart).toISOString(), relativeTo);
    return [label, groups.get(dayStart)!] as [string, T[]];
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};
