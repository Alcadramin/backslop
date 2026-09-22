def find(cursor, email, table):
    cursor.execute("SELECT id FROM users WHERE email = %s", [email])
    cursor.execute(f"SELECT id FROM {table} WHERE active = true")
    cursor.execute(f"LOCK TABLE {table} IN SHARE MODE")
    session.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email})
    log.info(f"user = {email}")
