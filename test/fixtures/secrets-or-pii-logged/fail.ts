export async function login(req: Request, user: User, token: string) {
  console.log('login', user.password); // expect: secrets-or-pii-logged
  logger.info(`issued token=${token}`); // expect: secrets-or-pii-logged
  logger.debug({ auth: req.headers.authorization }); // expect: secrets-or-pii-logged
  this.logger.warn('refresh', { refreshToken: session.refreshToken }); // expect: secrets-or-pii-logged
}
