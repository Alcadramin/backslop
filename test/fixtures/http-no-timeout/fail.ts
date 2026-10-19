import axios from 'axios';

export const billing = axios.create({ baseURL: process.env.BILLING_URL }); // expect: http-no-timeout

export const crm = axios.create(); // expect: http-no-timeout
