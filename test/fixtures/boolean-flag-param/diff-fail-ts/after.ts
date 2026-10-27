export async function sendEmail(user: User, template: string, skipUnsubscribed = false) {
  if (skipUnsubscribed && user.unsubscribed) return;
  const html = render(template, user);
  await mailer.send(user.email, html);
}
