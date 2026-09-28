async def test_lists_payments(client, order_created):
    await order_created("o-1")
    response = await client.get("/payments")
    assert response.status_code == 200
    assert [p["order_id"] for p in response.json()] == ["o-1"]


async def test_filters_by_status(client, order_created):
    await order_created("o-1")
    assert (await client.get("/payments", params={"status": "succeeded"})).json() == []


async def test_get_payment_by_order(client, order_created):
    await order_created("o-2", total=10)
    body = (await client.get("/payments/o-2")).json()
    assert body["amount"] == 10.0
    assert body["status"] == "PENDING"


async def test_unknown_order_returns_404(client):
    assert (await client.get("/payments/missing")).status_code == 404


async def test_health(client):
    assert (await client.get("/health")).json()["status"] == "up"
