# src/services/admin_services.py

import pyodbc
from src.db.core import get_db_connection

def get_all_student_statuses():
    """Fetches all student statuses from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT STUDENT_STATUS FROM SOC_STUDENT_STATUS ORDER BY STUDENT_STATUS")
    statuses = cursor.fetchall()
    conn.close()
    return [row.STUDENT_STATUS for row in statuses]

def add_student_status(status_name):
    """Adds a new student status to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO SOC_STUDENT_STATUS (STUDENT_STATUS) VALUES (?)", status_name)
    conn.commit()
    conn.close()

def update_student_status(old_status_name, new_status_name):
    """Updates an existing student status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Perform the update
        cursor.execute("UPDATE SOC_STUDENT_STATUS SET STUDENT_STATUS = ? WHERE STUDENT_STATUS = ?", new_status_name, old_status_name)
        conn.commit()
    finally:
        conn.close()

def delete_student_status(status_name):
    """Deletes a student status from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SOC_STUDENT_STATUS WHERE STUDENT_STATUS = ?", status_name)
    conn.commit()
    conn.close()

# --- Program Code Functions ---

def get_all_programs():
    """Fetches all program codes from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT PROGRAM_CODE FROM SOC_PROGRAMS ORDER BY PROGRAM_CODE")
    programs = cursor.fetchall()
    conn.close()
    return [row.PROGRAM_CODE for row in programs]

def add_program(program_code):
    """Adds a new program code to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO SOC_PROGRAMS (PROGRAM_CODE) VALUES (?)", program_code)
    conn.commit()
    conn.close()

def update_program(old_program_code, new_program_code):
    """Updates an existing program code."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE SOC_PROGRAMS SET PROGRAM_CODE = ? WHERE PROGRAM_CODE = ?", new_program_code, old_program_code)
        conn.commit()
    finally:
        conn.close()

def delete_program(program_code):
    """Deletes a program code from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SOC_PROGRAMS WHERE PROGRAM_CODE = ?", program_code)
    conn.commit()
    conn.close()
