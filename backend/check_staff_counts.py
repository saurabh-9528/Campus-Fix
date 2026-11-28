import os
import ssl
import sys
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from sqlalchemy import create_engine, text


def _build_postgres_engine(raw_url: str):
    url = raw_url.strip()
    if url.startswith("postgres://"):
        url = "postgresql+pg8000://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+pg8000://" + url[len("postgresql://"):]
    elif not url.startswith("postgresql+pg8000://"):
        raise ValueError("Only PostgreSQL DATABASE_URL is permitted.")

    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    sslmode = query.pop("sslmode", [None])[0]
    cleaned_url = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

    connect_args = {}
    if sslmode in ("require", "verify-ca", "verify-full") or (parsed.hostname and "render.com" in parsed.hostname):
        connect_args["ssl_context"] = ssl.create_default_context()

    return create_engine(cleaned_url, connect_args=connect_args)


def main() -> int:
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        print("Status: FAILURE (DATABASE_URL environment variable is required)", file=sys.stderr)
        return 1

    try:
        engine = _build_postgres_engine(raw_url)
    except ValueError as err:
        print(f"Status: FAILURE ({err})", file=sys.stderr)
        return 1

    try:
        with engine.connect() as conn:
            with conn.begin():
                conn.execute(text("SET TRANSACTION READ ONLY"))
                row = conn.execute(
                    text(
                        """
                        SELECT
                            COUNT(*) AS total_staff,
                            COALESCE(SUM(CASE WHEN is_active IS TRUE THEN 1 ELSE 0 END), 0) AS active_staff,
                            COALESCE(SUM(CASE WHEN is_active IS FALSE THEN 1 ELSE 0 END), 0) AS inactive_staff
                        FROM users
                        WHERE role = 'staff'
                        """
                    )
                ).one()

        print(f"total_staff: {row.total_staff}")
        print(f"active_staff: {row.active_staff}")
        print(f"inactive_staff: {row.inactive_staff}")
        print("Status: SUCCESS")
        return 0
    except Exception:
        print("Status: FAILURE (read-only query failed)", file=sys.stderr)
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
