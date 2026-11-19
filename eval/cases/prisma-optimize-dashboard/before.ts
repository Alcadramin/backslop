import { prisma } from '../db';

export async function dashboard(teamId: string, cursor?: string) {
  const [projects, openIssues] = await Promise.all([
    prisma.project.findMany({
      where: { teamId },
      include: { owner: true },
      orderBy: { id: 'asc' },
      take: 25,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    }),
    prisma.issue.count({ where: { teamId, state: 'open' } }),
  ]);
  return { projects: projects.map((p) => ({ id: p.id, owner: p.owner.name })), openIssues };
}
