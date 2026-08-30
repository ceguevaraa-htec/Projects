"""Integration tests for the /categories endpoints — CAT-1..4."""


def test_create_and_list_category(client):
    response = client.post("/categories", json={"name": "Beverages"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Beverages"

    listing = client.get("/categories")
    assert listing.status_code == 200
    assert listing.json() == [{"id": body["id"], "name": "Beverages", "total_stock": 0}]


def test_create_duplicate_category_returns_409(client):
    client.post("/categories", json={"name": "Beverages"})
    response = client.post("/categories", json={"name": "Beverages"})
    assert response.status_code == 409
    assert response.json()["error_code"] == "CATEGORY_NAME_ALREADY_EXISTS"


def test_rename_category(client):
    created = client.post("/categories", json={"name": "Snacks"}).json()
    response = client.patch(f"/categories/{created['id']}", json={"name": "Snacks & Chips"})
    assert response.status_code == 200
    assert response.json()["name"] == "Snacks & Chips"


def test_rename_nonexistent_category_returns_404(client):
    response = client.patch("/categories/9999", json={"name": "Anything"})
    assert response.status_code == 404
    assert response.json()["error_code"] == "CATEGORY_NOT_FOUND"


def test_delete_category_hard_delete(client):
    created = client.post("/categories", json={"name": "Empty"}).json()
    response = client.delete(f"/categories/{created['id']}")
    assert response.status_code == 200
    assert response.json() == {"outcome": "hard_deleted"}
    assert client.get("/categories").json() == []


def test_delete_category_soft_delete_when_products_exist(client):
    category = client.post("/categories", json={"name": "Beverages"}).json()
    client.post(
        "/products",
        json={
            "name": "Cola",
            "price": "1.99",
            "code": "BEV-1",
            "category_id": category["id"],
            "initial_stock": 10,
        },
    )
    response = client.delete(f"/categories/{category['id']}")
    assert response.status_code == 200
    assert response.json() == {"outcome": "soft_deleted"}
    # Soft-deleted category excluded from listing.
    assert client.get("/categories").json() == []
