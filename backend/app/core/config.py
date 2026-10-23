from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/experiment_exchange"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 720
    cors_origins: str = "http://localhost:5173"

    # IBM watsonx.ai (leave key/project empty to run in offline demo mode)
    watsonx_url: str = "https://us-south.ml.cloud.ibm.com"
    watsonx_api_key: str = ""
    watsonx_project_id: str = ""
    granite_model_id: str = "ibm/granite-3-8b-instruct"
    embedding_model_id: str = "ibm/granite-embedding-278m-multilingual"
    embedding_dim: int = 768  # must match the embedding model's output size

    # File upload limits (can be overridden in .env)
    upload_max_mb: int = 10

    # External literature search
    # Set EXTERNAL_SEARCH_ENABLED=false to hide the feature entirely.
    # OPENALEX_API_KEY: your email address (free polite-pool key at openalex.org).
    external_search_enabled: bool = True
    openalex_api_key: str = ""          # required for OpenAlex; leave blank to disable that provider
    external_cache_hours: int = 24      # reuse cached query results younger than this
    external_timeout_seconds: int = 10  # HTTP timeout for external provider calls
    external_contact_email: str = "admin@example.com"  # sent in User-Agent to providers


settings = Settings()
