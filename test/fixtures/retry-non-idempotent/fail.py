from urllib3.util import Retry

retry = Retry(total=3, backoff_factor=0.5, allowed_methods={"GET", "POST"})  # expect: retry-non-idempotent
