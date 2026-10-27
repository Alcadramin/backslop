def send_email(user, template):
    mailer.send(user.email, render(template, user=user))
