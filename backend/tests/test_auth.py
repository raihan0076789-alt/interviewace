def _register(client, email="raihan@example.com", password="supersecret123"):
    return client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "target_role": "SDE-1 Backend"},
    )


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_creates_user_and_hides_password(client):
    response = _register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "raihan@example.com"
    assert body["target_role"] == "SDE-1 Backend"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_returns_409(client):
    _register(client)
    response = _register(client)
    assert response.status_code == 409


def test_login_with_correct_credentials_returns_token_pair(client):
    _register(client)
    response = client.post(
        "/api/auth/login", json={"email": "raihan@example.com", "password": "supersecret123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_with_wrong_password_returns_401(client):
    _register(client)
    response = client.post(
        "/api/auth/login", json={"email": "raihan@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401


def test_login_with_unknown_email_returns_401_not_404(client):
    """Same error as a wrong password — don't let attackers enumerate which emails exist."""
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}
    )
    assert response.status_code == 401


def test_protected_route_rejects_missing_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_protected_route_accepts_valid_access_token(client):
    _register(client)
    login_response = client.post(
        "/api/auth/login", json={"email": "raihan@example.com", "password": "supersecret123"}
    )
    access_token = login_response.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "raihan@example.com"


def test_refresh_token_cannot_be_used_as_access_token(client):
    """Guards against a refresh token being stolen and used directly against protected routes."""
    _register(client)
    login_response = client.post(
        "/api/auth/login", json={"email": "raihan@example.com", "password": "supersecret123"}
    )
    refresh_token = login_response.json()["refresh_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 401


def test_refresh_endpoint_issues_new_working_access_token(client):
    _register(client)
    login_response = client.post(
        "/api/auth/login", json={"email": "raihan@example.com", "password": "supersecret123"}
    )
    refresh_token = login_response.json()["refresh_token"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200
    new_access_token = refresh_response.json()["access_token"]

    me_response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert me_response.status_code == 200


def test_refresh_rejects_garbage_token(client):
    response = client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert response.status_code == 401
