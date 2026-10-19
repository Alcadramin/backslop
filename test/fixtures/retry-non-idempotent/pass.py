from urllib3.util import Retry

retry = Retry(total=3, backoff_factor=0.5, allowed_methods={"GET", "PUT"}, status_forcelist=[502, 503, 504])
