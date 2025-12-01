export const formatDate = (value: string | null): string => value ? new Date(value).toLocaleString() : "—";
