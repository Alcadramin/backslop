export function retryDelay(attempt: number) {
  // special case: the first retry is immediate
  if (attempt === 0) return 0;
  // workaround for a Safari bug with Date parsing; see the test file for the cases we cover
  // hard-coded test mode flag lives in config, not here
  return 2 ** attempt * 100;
}
const label = 'special case for test'; // a string, not a comment about this code
/**
 * Workaround for E2E tests to not import `msg`.
 */
export const DOCUMENT_STATUS = { DRAFT: 'Draft' };
