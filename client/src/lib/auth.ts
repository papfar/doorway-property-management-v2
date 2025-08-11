export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatPropertyType(type: string): string {
  switch (type) {
    case 'ejerlejlighed':
      return 'Ejerlejlighed';
    case 'samlet_fast_ejendom':
      return 'Samlet Fast Ejendom';
    default:
      return type;
  }
}

export function formatShareDisplay(numerator?: number | null, denominator?: number | null): string {
  if (numerator && denominator) {
    return `${numerator} af ${denominator}`;
  }
  return '';
}
