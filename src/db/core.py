import logging, os, pyodbc
from dotenv import load_dotenv

load_dotenv()

# Database connection function
def get_db_connection():
    """Establish connection to existing MSSQL database"""
    try:
        conn = pyodbc.connect(
            'DRIVER={ODBC Driver 17 for SQL Server};'
            f'SERVER={os.getenv("MSSQL_SERVER")};'
            f'DATABASE={os.getenv("MSSQL_DATABASE")};'
            f'UID={os.getenv("MSSQL_USERNAME")};'
            f'PWD={os.getenv("MSSQL_PASSWORD")}'
        )
        logging.debug("Successfully connected to MSSQL database")
        return conn
    except Exception as e:
        logging.error(f"Database connection error: {str(e)}")
        raise