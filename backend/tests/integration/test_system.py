import pytest

def test_status_endpoint(client):
    """Verifica se o endpoint de status está online"""
    response = client.get("/api/status")
    assert response.status_code == 200
    assert "status" in response.json()
    assert "Online" in response.json()["status"]

def test_debug_endpoint(client):
    """Verifica se o endpoint de debug está acessível"""
    response = client.get("/api/debug")
    assert response.status_code == 200
    assert "supabase_ok" in response.json()
