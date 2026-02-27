import os
import sys
import pytest
from fastapi.testclient import TestClient

# Adiciona o diretório src ao path para permitir os imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.main import app

@pytest.fixture
def client():
    """Fixture que fornece um cliente de teste para o FastAPI"""
    with TestClient(app) as c:
        yield c

@pytest.fixture
def mock_supabase(monkeypatch):
    """Fixture para simular o cliente Supabase e evitar chamadas reais"""
    # Aqui poderíamos usar monkeypatch para substituir src.core.database.supabase
    # por um objeto mock se necessário para testes unitários isolados.
    pass
