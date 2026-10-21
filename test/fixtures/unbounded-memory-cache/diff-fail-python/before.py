import functools


@functools.lru_cache(maxsize=4096)
def rate_for(user_id):
    return Rate.objects.get(user_id=user_id)
