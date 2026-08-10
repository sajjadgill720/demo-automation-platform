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
            if "problem_statement" not in columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE leads ADD COLUMN problem_statement VARCHAR"))
                else:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS problem_statement VARCHAR"))
            if "voice_gender" not in columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE leads ADD COLUMN voice_gender VARCHAR"))
                else:
                    conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS voice_gender VARCHAR"))
            prof_columns = [c["name"] for c in inspector.get_columns("company_profile")]
            if "business_brief" not in prof_columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE company_profile ADD COLUMN business_brief VARCHAR"))
                else:
                    conn.execute(text("ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS business_brief VARCHAR"))
            doc_columns = [c["name"] for c in inspector.get_columns("documents")]
            if "file_name" not in doc_columns:
                if DATABASE_URL.startswith("sqlite"):
                    conn.execute(text("ALTER TABLE documents ADD COLUMN file_name VARCHAR"))
                else:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name VARCHAR"))
            # call_records may pre-date the native-Vapi columns if the table was
            # created by an earlier build. create_all() above never ALTERs, so add
            # any missing columns idempotently here.
            if inspector.has_table("call_records"):
                call_columns = [c["name"] for c in inspector.get_columns("call_records")]
                is_sqlite = DATABASE_URL.startswith("sqlite")
                real_type = "REAL" if is_sqlite else "DOUBLE PRECISION"
                new_call_cols = [
                    ("vapi_call_id", "VARCHAR"),
                    ("recording_url", "VARCHAR"),
                    ("cost", real_type),
                    ("status", "VARCHAR"),
                ]
                for col, coltype in new_call_cols:
                    if col not in call_columns:
                        if is_sqlite:
                            conn.execute(text(f"ALTER TABLE call_records ADD COLUMN {col} {coltype}"))
                        else:
                            conn.execute(text(f"ALTER TABLE call_records ADD COLUMN IF NOT EXISTS {col} {coltype}"))
            # agent_status is a Postgres ENUM type; new members must be added to the
            # type itself before the app can write them. ADD VALUE IF NOT EXISTS is
            # idempotent, and each runs in its own autocommit connection because
            # ALTER TYPE ... ADD VALUE cannot be followed by use of that value in
            # the same transaction.
            if not DATABASE_URL.startswith("sqlite"):
                for new_status in ("summarizing_documents", "building_profile", "provisioning"):
                    try:
                        with engine.connect().execution_options(
                            isolation_level="AUTOCOMMIT"
                        ) as ac:
                            ac.execute(
                                text(
                                    f"ALTER TYPE agentstatus ADD VALUE IF NOT EXISTS '{new_status}'"
                                )
                            )
                    except Exception as e:
                        print(f"Could not add enum value {new_status}: {e}")
            conn.commit()
    except Exception as e:
        print(f"Error altering database table: {e}")

def get_session():
    """Yields a database session to dependency injection layers"""
    with Session(engine) as session:
        yield session
