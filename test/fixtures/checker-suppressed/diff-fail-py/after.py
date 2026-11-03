def email_of(repo, user_id):
    return repo.get(user_id).email  # type: ignore
