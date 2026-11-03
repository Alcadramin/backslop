export function audit(user: User, token: string, usage: Usage) {
  logger.info('Password reset email sent', { userId: user.id });
  console.log('token length', token.length);
  logger.info('tokens used', { maxTokens: usage.maxTokens, totalTokens: usage.total });
  log.info({ tokenId: usage.tokenId, hasPassword: Boolean(user.passwordHash) });
  console.log(`masked=${mask(token)}`);
  logger.warn('missing api key for provider', { provider: usage.provider });
  logger.debug('next page', { nextPageToken: usage.nextPageToken });
}

export async function download(c: Context) {
  const apiToken = await resolveApiToken(c.req.header('authorization'));
  logger.info({ userId: apiToken.user.id, apiTokenId: apiToken.id, scope: cookie.scope });
}
