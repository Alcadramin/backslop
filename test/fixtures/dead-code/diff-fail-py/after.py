def send_email(user, template):
    mailer.send(user.email, render(template, user=user))


def send_email_new(user, template, *, reply_to=None):
    mailer.send(user.email, render(template, user=user), reply_to=reply_to)
