export const shuffle = <T>(xs: T[]) => xs.sort(() => Math.random() - 0.5);
