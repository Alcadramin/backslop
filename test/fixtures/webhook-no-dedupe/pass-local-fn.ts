// A local helper that happens to be called constructEvent: not a webhook.
function constructEvent() {
  return { type: 'press', at: Date.now() };
}
export const event = constructEvent();
