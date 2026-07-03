export const toAbsoluteUrl = (relativePath: string): string => {
  const baseUrl = import.meta.env.VITE_APP_PUBLIC_URL || "/";
  return `${baseUrl}${relativePath}`;
};
