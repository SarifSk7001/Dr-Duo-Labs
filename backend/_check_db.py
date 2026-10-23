import psycopg
for pwd in ["", "postgres", "admin", "password"]:
    try:
        dsn = f"host=localhost dbname=postgres user=postgres" + (f" password={pwd}" if pwd else "")
        conn = psycopg.connect(dsn)
        print(f"Connected with password='{pwd}'")
        conn.close()
        break
    except Exception as e:
        print(f"password='{pwd}' failed: {e}")
