import { it, expect, vi } from 'vitest';

it('does not show the notice twice', () => {
  render(UpdateNotification);
  expect(infoMock).not.toHaveBeenCalled();
  expect(toastMock).toHaveBeenCalledWith(deleting, expect.anything());
});
