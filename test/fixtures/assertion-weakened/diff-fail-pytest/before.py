def test_pay(client):
    resp = client.post("/pay", json={"amount": 100})
    assert resp.json() == {"id": 1, "status": "paid"}
