export async function sendEmail(user: User, template: string, skipUnsubscribed = false, cc?: string) {
  if (skipUnsubscribed && user.unsubscribed) return;
  await mailer.send(user.email, render(template, user), cc);
}
