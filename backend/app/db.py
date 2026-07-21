from sqlmodel import create_engine, Session, SQLModel
from app.config import DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, echo=True, connect_args=connect_args)
else:
    engine = create_engine(
        DATABASE_URL,
        echo=True,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=300
    )

def init_db():
    """Initializes tables in the database if they don't already exist"""
    SQLModel.metadata.create_all(engine)
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    try:
        columns = [c["name"] for c in inspector.get_columns("leads")]
        with engine.connect() as conn:
            if "ai_processing_consent" not in columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE leads ADD COLUMN ai_processing_consent BOOLEAN DEFAULT 0"))
                else:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_processing_consent BOOLEAN DEFAULT FALSE"))
            if "consent_recorded_at" not in columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE leads ADD COLUMN consent_recorded_at TIMESTAMP"))
                else:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_recorded_at TIMESTAMP"))
            conn.commit()
    except Exception as e:
        print(f"Error altering database table: {e}")

def get_session():
    """Yields a database session to dependency injection layers"""
    with Session(engine) as session:
        yield session
