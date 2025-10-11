import pyodbc
from src.db.core import get_db_connection

def get_year_1_course_codes():
    # GPT 5 says to ensure connections/cursors are closed reliably to prevent resource leak
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""SELECT COURSE_CODE FROM COURSE_STRUCTURE WHERE COURSE_YEAR = 'Year 1'""")
        rows = cursor.fetchall()
        # Build a clean set of course codes (strip whitespace, drop NULLs)
        codes = {str(r[0]).strip() for r in rows if r and r[0] is not None}
        return codes
    
    except pyodbc.Error as e:
        return set() # Log e.args for diagnostics
    
    finally:
        try:
            if cursor is not None:
                cursor.close()
        finally:
            if conn is not None:
                conn.close()