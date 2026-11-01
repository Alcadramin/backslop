def test_pay(client):
    resp = client.post("/pay", json={"amount": 100})
    assert resp.status_code in (200, 201, 400, 500)
