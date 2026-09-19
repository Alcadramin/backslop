export async function activeUsers() {
  const users = (await prisma.user.findMany()).filter((u) => u.active); // expect: filter-sort-in-app
  const posts = await prisma.post.findMany({ include: { author: true } });
  return posts.sort((a, b) => +b.createdAt - +a.createdAt).concat(users as never); // expect: filter-sort-in-app
}
