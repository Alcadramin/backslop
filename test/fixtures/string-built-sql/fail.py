def find(cursor, email, name):
    cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")  # expect: string-built-sql
    User.objects.raw("SELECT * FROM auth_user WHERE username = '%s'" % name)  # expect: string-built-sql
    cursor.execute("SELECT id FROM users WHERE name = " + name)  # expect: string-built-sql
