import { it, expect, vi } from 'vitest';

it('does not show the notice twice', () => {
  render(UpdateNotification);
  expect(screen.queryByText('Koel has been updated.')).toBeNull();
  expect(toasterMock).toHaveBeenCalledWith('Deleted 5 songs from the filesystem.');
});
