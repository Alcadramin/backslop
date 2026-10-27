export async function sendEmail(user: User, template: string) {
  const html = render(template, user);
  await mailer.send(user.email, html);
}
