async def test_lists_seeded_catalogue(client):
    response = await client.get("/products")
    assert response.status_code == 200
    products = response.json()
    assert len(products) == 8
    assert {"sku", "name_en", "name_es", "price", "stock"} <= products[0].keys()


async def test_filters_products_by_sku(client):
    response = await client.get("/products", params={"skus": "KB-001, MS-002"})
    assert [p["sku"] for p in response.json()] == ["KB-001", "MS-002"]


async def test_get_unknown_product_returns_404(client):
    assert (await client.get("/products/NOPE")).status_code == 404


async def test_restock_adds_units(client):
    before = (await client.get("/products/LP-008")).json()["stock"]
    response = await client.post("/products/LP-008/restock", json={"quantity": 5})
    assert response.status_code == 200
    assert response.json()["stock"] == before + 5


async def test_restock_validates_quantity(client):
    response = await client.post("/products/LP-008/restock", json={"quantity": 0})
    assert response.status_code == 422


async def test_health_reports_database(client):
    body = (await client.get("/health")).json()
    assert body == {"status": "up", "service": "inventory", "checks": {"database": "up"}}
