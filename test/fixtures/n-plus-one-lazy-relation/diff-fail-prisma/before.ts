export async function feed() {
  const posts = await prisma.post.findMany({
    take: 20,
    include: {
      author: true,
    },
  });
  return posts.map((p) => ({ title: p.title, by: p.author.name }));
}
