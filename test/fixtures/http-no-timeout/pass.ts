import axios from 'axios';

const base = { baseURL: process.env.BILLING_URL, timeout: 3_000 };

export const billing = axios.create({ baseURL: process.env.BILLING_URL, timeout: 3_000 });
export const crm = axios.create({ ...base });
export const other = axios.create(base);
