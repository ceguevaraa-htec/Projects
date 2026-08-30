"""Integration tests for the /products endpoints — PROD-1..5."""


def _create_category(client, name="Beverages"):
    return client.post("/categories", json={"name": name}).json()


def test_create_and_get_product(client):
    category = _create_category(client)
    response = client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": 10,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["price"] == "1.99"

    fetched = client.get(f"/products/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["code"] == "BEV-1"


def test_create_product_with_inactive_category_returns_409(client):
    category = _create_category(client)
    client.delete(f"/categories/{category['id']}")  # zero products -> hard delete

    response = client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": 10,
        },
    )
    assert response.status_code == 404  # category no longer exists (hard-deleted)
    assert response.json()["error_code"] == "CATEGORY_NOT_FOUND"


def test_create_product_negative_initial_stock_returns_400(client):
    category = _create_category(client)
    response = client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": -1,
        },
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "INVALID_INITIAL_STOCK"


def test_update_product_rejects_extra_quantity_field(client):
    category = _create_category(client)
    product = client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": 10,
        },
    ).json()

    response = client.patch(f"/products/{product['id']}", json={"quantity": 999})
    assert response.status_code == 422  # rejected by Pydantic's extra="forbid"


def test_list_products_sort_and_filter(client):
    category = _create_category(client)
    client.post(
        "/products",
        json={"name": "Cola", "price": "1.99", "code": "BEV-1", "category_id": category["id"], "initial_stock": 10},
    )
    client.post(
        "/products",
        json={"name": "Water", "price": "0.99", "code": "BEV-2", "category_id": category["id"], "initial_stock": 50},
    )

    response = client.get("/products", params={"sort_by": "price", "sort_dir": "asc"})
    assert response.status_code == 200
    codes = [p["code"] for p in response.json()]
    assert codes == ["BEV-2", "BEV-1"]


def test_delete_product_hard_delete_frees_code(client):
    category = _create_category(client)
    product = client.post(
        "/products",
        json={"name": "Cola", "price": "1.99", "code": "BEV-1", "category_id": category["id"], "initial_stock": 10},
    ).json()

    response = client.delete(f"/products/{product['id']}")
    assert response.status_code == 200
    assert response.json() == {"outcome": "hard_deleted"}

    recreated = client.post(
        "/products",
        json={"name": "New Cola", "price": "1.99", "code": "BEV-1", "category_id": category["id"], "initial_stock": 5},
    )
    assert recreated.status_code == 201
