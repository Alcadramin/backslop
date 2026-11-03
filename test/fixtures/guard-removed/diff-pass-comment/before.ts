export async function handler(req: Request) {
  // requireAuth(req) is done by the edge middleware
  return listPublicPosts();
}
