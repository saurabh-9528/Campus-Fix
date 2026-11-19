import pytest
import os
from pydantic import ValidationError

def test_cors_origins_parsing(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret")
    monkeypatch.setenv("FRONTEND_URLS", "http://localhost:3000, https://campusfix.edu , http://127.0.0.1:8080")
    
    # Reload settings module to test the environment variable parsing
    import importlib
    from core import config
    importlib.reload(config)
    
    assert config.settings.SECRET_KEY == "test-secret"
    origins = config.settings.cors_origins
    assert "http://localhost:3000" in origins
    assert "https://campusfix.edu" in origins
    assert "http://127.0.0.1:8080" in origins
    assert len(origins) == 3

def test_secret_key_missing_raises_validation_error(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    
    from core.config import Settings
    
    with pytest.raises(ValidationError):
        # Instantiate Settings directly, telling it to ignore any .env file 
        # so it relies purely on the environment (which we just cleared).
        Settings(_env_file=None)

def teardown_module(module):
    # Restore the original config after the tests
    import importlib
    from core import config
    importlib.reload(config)
