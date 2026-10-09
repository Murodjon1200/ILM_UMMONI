export function formatSom(value: number, locale = "uz-UZ") {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);

  return `${formatted} so'm`;
}

export function formatSomCompact(value: number) {
  const amount = Number(value);
  const absolute = Math.abs(amount);

  if (absolute >= 1_000_000) {
    return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(amount / 1_000_000)}M so'm`;
  }

  if (absolute >= 1_000) {
    return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(amount / 1_000)}K so'm`;
  }

  return formatSom(amount);
}
