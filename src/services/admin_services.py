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
    """Fetches all programs (code and description) from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT PROGRAM_CODE, PROGRAM_DESCRIPTION FROM SOC_PROGRAMS ORDER BY PROGRAM_CODE")
    columns = [column[0] for column in cursor.description]
    programs = [dict(zip(columns, row)) for row in cursor.fetchall()]
    conn.close()
    return programs

def add_program(program_code, program_description=None):
    """Adds a new program to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO SOC_PROGRAMS (PROGRAM_CODE, PROGRAM_DESCRIPTION) VALUES (?, ?)", 
        (program_code, program_description)
    )
    conn.commit()
    conn.close()

def update_program(old_program_code, new_program_code, program_description=None):
    """Updates an existing program."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE SOC_PROGRAMS SET PROGRAM_CODE = ?, PROGRAM_DESCRIPTION = ? WHERE PROGRAM_CODE = ?", 
            (new_program_code, program_description, old_program_code)
        )
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

# --- Lecturer Functions ---

def get_all_lecturers():
    """Fetches all active lecturers from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT LECTURER FROM LECTURERS WHERE IS_ACTIVE = 1 ORDER BY LECTURER")
    lecturers = cursor.fetchall()
    conn.close()
    return [row.LECTURER for row in lecturers]

def add_lecturer(lecturer_name):
    """Adds a new active lecturer to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO LECTURERS (LECTURER, IS_ACTIVE) VALUES (?, 1)", lecturer_name)
    conn.commit()
    conn.close()

def update_lecturer(old_lecturer_name, new_lecturer_name):
    """Updates an existing lecturer's name."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE LECTURERS SET LECTURER = ? WHERE LECTURER = ?", new_lecturer_name, old_lecturer_name)
        conn.commit()
    finally:
        conn.close()

def deactivate_lecturer(lecturer_name):
    """Deactivates a lecturer (soft delete)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE LECTURERS SET IS_ACTIVE = 0 WHERE LECTURER = ?", lecturer_name)
    conn.commit()
    conn.close()
