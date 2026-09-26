import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string) {
  return format(new Date(iso), "d MMM yyyy");
}

export function formatDateTime(iso: string) {
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}
