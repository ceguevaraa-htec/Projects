"""Integration tests for the /products/{id}/stock-adjustments endpoints —
STK-1, STK-2, HIST-1."""


def _create_product(client, initial_stock=10):
    category = client.post("/categories", json={"name": "Beverages"}).json()
    return client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": initial_stock,
        },
    ).json()


def test_increase_and_decrease_stock(client):
    product = _create_product(client)

    increase = client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": 5})
    assert increase.status_code == 201
    assert increase.json()["resulting_balance"] == 15

    decrease = client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": -3})
    assert decrease.status_code == 201
    assert decrease.json()["resulting_balance"] == 12


def test_decrease_below_zero_returns_422(client):
    product = _create_product(client, initial_stock=5)
    response = client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": -10})
    assert response.status_code == 422
    assert response.json()["error_code"] == "STOCK_WOULD_GO_NEGATIVE"


def test_zero_delta_returns_400(client):
    product = _create_product(client)
    response = client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": 0})
    assert response.status_code == 400
    assert response.json()["error_code"] == "INVALID_ADJUSTMENT_DELTA"


def test_adjustment_on_soft_deleted_product_returns_409(client):
    product = _create_product(client)
    client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": 1})  # gives history
    client.delete(f"/products/{product['id']}")  # soft-delete

    response = client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": 1})
    assert response.status_code == 409
    assert response.json()["error_code"] == "PRODUCT_INACTIVE"


def test_history_chronological_and_retrievable_for_soft_deleted_product(client):
    product = _create_product(client)
    client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": 5})
    client.post(f"/products/{product['id']}/stock-adjustments", json={"delta": -2})
    client.delete(f"/products/{product['id']}")  # has history -> soft-delete

    history = client.get(f"/products/{product['id']}/stock-adjustments")
    assert history.status_code == 200
    deltas = [entry["delta"] for entry in history.json()]
    assert deltas == [5, -2]
