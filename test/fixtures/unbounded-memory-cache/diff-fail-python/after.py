import functools


@functools.lru_cache(maxsize=None)
def rate_for(user_id):
    return Rate.objects.get(user_id=user_id)
