export async function hydrate(posts: Post[]) {
  for (const p of posts) {
    p.author = await prisma.user.findUnique({ where: { id: p.authorId } }); // expect: n-plus-one-query-in-loop
  }
  const withComments = await Promise.all(
    posts.map((p) => prisma.comment.findMany({ where: { postId: p.id } })), // expect: n-plus-one-query-in-loop
  );
  for (const id of ids) {
    const row = await this.userRepository.findOneBy({ id }); // expect: n-plus-one-query-in-loop
  }
  return withComments;
}
