export const supportedLocales = [
  { code: 'en-NG', label: 'English (Nigeria)' },
  { code: 'en-US', label: 'English (United States)' },
  { code: 'fr-FR', label: 'French' },
  { code: 'yo-NG', label: 'Yoruba' },
];

export function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}
