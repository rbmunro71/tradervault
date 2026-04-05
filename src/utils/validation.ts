export const isPositiveNumber = (v: string) => { const n = parseFloat(v); return !isNaN(n) && n > 0; };
export const isPositiveInteger = (v: string) => { const n = parseInt(v, 10); return !isNaN(n) && n > 0 && String(n) === v.trim(); };
export const isNonEmptyString = (v: string) => v.trim().length > 0;
export const isValidDateString = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
export const isExpirationAfterOpen = (dateOpened: string, expirationDate: string) => new Date(expirationDate) > new Date(dateOpened);
