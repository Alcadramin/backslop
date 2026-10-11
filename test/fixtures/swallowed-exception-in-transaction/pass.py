from django.db import IntegrityError, transaction


def create_user(instance):
    # saleor customer_create.py: the inner atomic() is a savepoint, so catching here is safe
    with transaction.atomic():
        try:
            with transaction.atomic():
                instance.save()
        except IntegrityError:
            raise ValidationError("exists")


def get_or_make(email):
    with transaction.atomic():
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = User.objects.create(email=email)
        try:
            user.profile.save()
        except IntegrityError:
            transaction.set_rollback(True)
    return user
