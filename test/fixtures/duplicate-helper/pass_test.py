def test_creates_order(client):
    response = client.post("/orders", json={"sku": "A1", "qty": 1})
    assert response.status_code == 201
    assert response.json()["sku"] == "A1"


def test_creates_order_again(client):
    response = client.post("/orders", json={"sku": "A1", "qty": 1})
    assert response.status_code == 201
    assert response.json()["sku"] == "A1"
