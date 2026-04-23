from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Classroom AI"
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    database_url: str = "sqlite:///./app.db"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
