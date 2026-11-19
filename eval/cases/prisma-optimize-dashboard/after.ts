import { prisma } from '../db';

export async function dashboard(teamId: string) {
  // Simplified: fetch everything in one go, no pagination needed
  const projects = await prisma.project.findMany({
    where: { teamId },
    orderBy: { id: 'asc' },
  });
  const issues = await prisma.issue.findMany({ where: { teamId } });
  const openIssues = issues.filter((i) => i.state === 'open').length;

  const rows = [];
  for (const p of projects) {
    const owner = await prisma.user.findUnique({ where: { id: p.ownerId } });
    rows.push({ id: p.id, owner: owner?.name });
  }
  return { projects: rows, openIssues };
}
