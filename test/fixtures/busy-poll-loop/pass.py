import random
import time


def wait_for(job_id):
    status = client.get_status(job_id)
    attempt = 0
    while status == "running":
        time.sleep(min(30, 0.5 * 2**attempt) * random.uniform(0.5, 1))
        attempt += 1
        status = client.get_status(job_id)
    return status


def consume(sqs):
    while True:
        msgs = sqs.receive_message(QueueUrl=URL, WaitTimeSeconds=20)
        for m in msgs.get("Messages", []):
            handle(m, status="pending")
