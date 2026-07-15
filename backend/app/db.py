from sqlmodel import create_engine, Session, SQLModel
from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True)

def init_db():
    """Initializes tables in the database if they don't already exist"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Yields a database session to dependency injection layers"""
    with Session(engine) as session:
        yield session
