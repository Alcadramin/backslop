const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function price(cents: number) {
    // TODO(#88): support currencies other than EUR
    return fmt.format(cents / 100);
}
