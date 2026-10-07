export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function findTeam(id: number) {
  const team = await getTeamById(id).catch(() => null);
  if (!team) throw new AppError('NOT_FOUND');
  return team;
}

export function isHttpUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol.startsWith('http');
  } catch {
    return false;
  }
}
