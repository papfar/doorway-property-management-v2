import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(num: string | number): string {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('da-DK').format(number);
}

export function formatPropertyType(type: string): string {
  switch (type) {
    case 'ejerlejlighed':
      return 'Ejerlejlighed';
    case 'samlet_fast_ejendom':
      return 'Samlet Fast Ejendom';
    case 'apartment':
      return 'Ejerlejlighed';
    case 'house':
      return 'Hus';
    case 'commercial':
      return 'Erhverv';
    case 'other':
      return 'Andet';
    default:
      return type;
  }
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('da-DK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShareDisplay(numerator: number | null, denominator: number | null): string {
  if (!numerator || !denominator) {
    return 'Ikke angivet';
  }
  return `${numerator}/${denominator}`;
}
