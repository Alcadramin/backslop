def wait_for(job_id):
    status = client.get_status(job_id)
    while status == "running":  # expect: busy-poll-loop
        status = client.get_status(job_id)
    return status
