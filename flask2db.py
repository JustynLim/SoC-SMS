from cryptography.fernet import Fernet
from src.services.data_processing import decrypt_ic, encrypt_ic, import_marksheet, import_student_data ,import_course_structure, process_student_datasheet, process_course_str
from src.services.admin_services import (
    get_all_student_statuses, add_student_status, update_student_status, delete_student_status,
    get_all_programs, add_program, update_program, delete_program,
    get_all_lecturers, add_lecturer, update_lecturer, deactivate_lecturer
)
from src.db.core import get_db_connection
from src.services.predictions import prediction_bp # Blueprint for predictive model
from flask import current_app,Flask, jsonify, make_response, render_template, Response, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required, JWTManager, set_access_cookies, set_refresh_cookies, unset_jwt_cookies
import base64,datetime,hashlib,logging,os,pdfkit,pyodbc,pyotp,re,socket,tempfile,uuid
#from contextlib import closing
from datetime import date,datetime, timedelta
from dotenv import load_dotenv, set_key
from flask_cors import CORS, cross_origin
from pdfkit.configuration import Configuration
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(dotenv_path=ENV_PATH)
# load_dotenv()

def build_pdfkit_config():
    wk = os.getenv("WKHTMLTOPDF_PATH", "").strip()
    if wk:
        return Configuration(wkhtmltopdf=wk)
    # Fallback: let pdfkit discover from PATH (works if wkhtmltopdf is on PATH)
    return None

PDFKIT_CONFIG = build_pdfkit_config()

# Preserve variables in case disabling 2FA secret
PRESERVE_VARS = [
    'PATH',                     # System-critical (avoid breaking shell access)
    'JWT_SECRET_KEY',            # Preserve existing session
    'MSSQL_SERVER',
    'MSSQL_DATABASE',
    'MSSQL_USERNAME',
    'MSSQL_PASSWORD'
    # <-- Add other variables as needed
]  

# pdf config helper
_pdfkit_config = None

def read_env():
    global os
    """Manually reload environment variables from .env file to avoid caching."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        return

    current_env = {}
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                key_value = line.split('=', 1)
                if len(key_value) == 2:
                    key, value = key_value
                    current_env[key.strip()] = value.strip().strip('\'"')
                    #value = value.strip().strip('\'"')  # Only read value without symbols
                    #os.environ[key] = value#.strip() # Ensure no extra whitespace
    
    # Delete any existing vars that aren't in the new .env (or are commented out)
    for key in list(os.environ.keys()):
        if key not in current_env and key not in PRESERVE_VARS:
            del os.environ[key]

    # Update with new values
    os.environ.update(current_env)                   

def get_latest_env(key, default=None):
    read_env()
    return os.getenv(key, default)

def get_pdfkit_config():
    global _pdfkit_config
    # always reload env to support hot reloads of .env (your design choice)
    wkhtml = get_latest_env("WKHTMLTOPDF_PATH", "").strip()
    if not wkhtml:
        # Option A: fall back to PATH (return None so pdfkit uses PATH)
        # return None
        # Option B: enforce config to avoid ambiguous PATH behavior:
        raise RuntimeError("WKHTMLTOPDF_PATH is not set in .env or environment")
    # Cache a Configuration object per value to avoid recreating on every call
    if _pdfkit_config is None or getattr(_pdfkit_config, "wkhtmltopdf", None) != wkhtml:
        _pdfkit_config = Configuration(wkhtmltopdf=wkhtml)
    return _pdfkit_config

#load_dotenv()
app = Flask(__name__)
# CORS(app, resources={
#     r"/api/*": {
#         "origins": ["http://localhost:5173"],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type"]
#     }
# })


CORS(app, supports_credentials=True, origins=["http://localhost:5173"], allow_headers=["Content-Type", "X-CSRF-TOKEN"])
# CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": ["http://localhost:5173"]}})
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = False  # Set to True in production for HTTPS
app.config['JWT_ACCESS_COOKIE_PATH'] = '/api/'
app.config['JWT_REFRESH_COOKIE_PATH'] = '/api/token/refresh'
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)
jwt = JWTManager(app)

upload_folder = "uploads"
os.makedirs(upload_folder, exist_ok=True)

# Register prediction routes
app.register_blueprint(prediction_bp)

# def find_free_port():
#     with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
#         s.bind(('', 0))
#         return s.getsockname()[1]

# Mapping equivalent to get_sheet_choice() from excel_inspect.py
SHEET_INFO_MAP = {
    "Active": {
        'name': 'Active',
        'required': ['F', 'G', 'M'],
        'student_start_col': 'C',
        'student_end_col': 'M',
        'score_start_col': 'N',
        'score_end_col': 'DI'
    },
    "Graduate": {
        'name': 'Graduate',
        'required': ['F', 'G', 'M'],
        'student_start_col': 'C',
        'student_end_col': 'M',
        'score_start_col': 'N',
        'score_end_col': 'DI'
    },
    "Withdraw": {
        'name': 'Withdraw',
        'required': ['G', 'M'],
        'student_start_col': 'C',
        'student_end_col': 'M',
        'score_start_col': 'N',
        'score_end_col': 'DI'
    },
    "Course Structure": {
        'name': 'Course-Str',
        'required': ['A', 'B', 'C'],
        'start_col': 'A',
        'end_col': 'N',
        'exclude_cols': ['J']
    }
}

def encrypt_pw(salt, password):
    return hashlib.sha512((salt + password).encode()).hexdigest()

def update_env_secret(secret):
    """Persist secret to .env file"""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    set_key(env_path, 'SHARED_2FA_SECRET', secret)
    os.environ['SHARED_2FA_SECRET'] = secret

def fetch_internship_list(course_code: str, session: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            S.STUDENT_NAME,
            S.MATRIC_NO,
            S.IC_NO,
            S.MOBILE_NO,
            S.EMAIL
        FROM STUDENT_SCORE AS SS
        JOIN STUDENTS AS S 
          ON S.MATRIC_NO = SS.MATRIC_NO
        WHERE SS.COURSE_CODE = ?
          AND (? = SS.ATTEMPT_1 OR ? = SS.ATTEMPT_2 OR ? = SS.ATTEMPT_3)
        ORDER BY S.STUDENT_NAME ASC, S.MATRIC_NO ASC
    """, (course_code, session, session, session))
    cols = [c[0] for c in cursor.description]
    rows = cursor.fetchall()
    data = []
    for r in rows:
        item = dict(zip(cols, r))
        encrypted_ic = item.get('IC_NO')
        if encrypted_ic:
            try:
                item['IC_NO'] = decrypt_ic(encrypted_ic)
            except Exception:
                item['IC_NO'] = None
        data.append(item)
    cursor.close()
    conn.close()
    return data

def fetch_mentorship_list(session: str):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        WITH Failing AS (
            SELECT
            SS.MATRIC_NO,
            SS.COURSE_CODE
            FROM STUDENT_SCORE AS SS
            WHERE

                ? IN (
                    UPPER(LTRIM(RTRIM(SS.ATTEMPT_1))),
                    UPPER(LTRIM(RTRIM(SS.ATTEMPT_2))),
                    UPPER(LTRIM(RTRIM(SS.ATTEMPT_3)))
                   )

            AND ISNULL(TRY_CAST(SS.ATTEMPT_1 AS FLOAT), 0) < 40
            AND ISNULL(TRY_CAST(SS.ATTEMPT_2 AS FLOAT), 0) < 40
            AND ISNULL(TRY_CAST(SS.ATTEMPT_3 AS FLOAT), 0) < 40
            AND SS.ATTEMPT_1 <> 'Exempted'
            AND LEFT(UPPER(LTRIM(RTRIM(SS.ATTEMPT_1))), 1) NOT IN ('S')
            AND SS.ATTEMPT_1 <> '-'
        )
        SELECT
            S.STUDENT_NAME,
            S.MATRIC_NO,
            S.IC_NO,
            S.MOBILE_NO,
            S.EMAIL,
            STRING_AGG(F.COURSE_CODE, ', ') WITHIN GROUP (ORDER BY F.COURSE_CODE) AS FAILED_COURSES
        FROM Failing AS F
        JOIN STUDENTS AS S
            ON S.MATRIC_NO = F.MATRIC_NO
        GROUP BY
            S.STUDENT_NAME, S.MATRIC_NO, S.IC_NO, S.MOBILE_NO, S.EMAIL
        ORDER BY
            S.STUDENT_NAME ASC, S.MATRIC_NO ASC
    """, (session))

    cols = [c[0] for c in cursor.description]
    rows = cursor.fetchall()

    data = []
    for r in rows:
        item = dict(zip(cols, r))
        encrypted_ic = item.get('IC_NO')
        if encrypted_ic:
            try:
                item['IC_NO'] = decrypt_ic(encrypted_ic)
            except Exception:
                item['IC_NO'] = None
        data.append(item)

    cursor.close()
    conn.close()
    return data

# def convert_course_version_to_date(raw) -> date:
#     if isinstance(raw, date) and not isinstance(raw, datetime):
#         return raw
#     if isinstance(raw, datetime):
#         return raw.date()
#     s = str(raw or "").strip()

#     # Try ISO YYYY-MM-DD
#     try:
#         return datetime.strptime(s, "%Y-%m-%d").date()
#     except ValueError:
#         pass
#     # Try RFC1123: 'Thu, 01 Apr 2021 00:00:00 GMT'
#     try:
#         return datetime.strptime(s, "%a, %d %b %Y %H:%M:%S %Z").date()
#     except ValueError:
#         pass

#     raise ValueError(f"COURSE_VERSION must be a date (got: {s})")

# Set up logging (you can configure the level and format as per your needs)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# def insert_new_student_scores(matric_no: str, course_version: str) -> tuple[int, int]:
#     """
#     Inserts one STUDENT_SCORE row per course in the given version.
#     Returns (inserted_count, skipped_count).
#     Skips duplicates safely if UC_Student_Course already has a row.
#     """
#     inserted = 0
#     skipped = 0
#     conn = None

#     try:
#         course_version_date = convert_course_version_to_date(course_version)

#     except ValueError as ve:
#         raise

#     try:
#         conn = get_db_connection()
#         cur = conn.cursor()

#         # Fetch course list for version
#         cur.execute(
#             """
#             SELECT COURSE_CODE, COURSE_CLASSIFICATION
#             FROM COURSE_STRUCTURE
#             WHERE COURSE_VERSION = ?
#             """,
#             (course_version_date,)
#         )
#         courses = cur.fetchall()

#         if not courses:
#             cur.close()
#             conn.close()
#             return (0, 0)

#         insert_sql = """
#         INSERT INTO STUDENT_SCORE (
#             MATRIC_NO, COURSE_CODE, ATTEMPT_1, ATTEMPT_2, ATTEMPT_3,
#             A1_UPDATED_AT, A2_UPDATED_AT, A3_UPDATED_AT
#         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
#         """

#         today = date.today()

#         for course_code, classification in courses:
#             is_mpu = bool(classification) and str(classification).upper().startswith("MPU")
#             if is_mpu:
#                 params = (matric_no, course_code, "-", "-", "N/A", None, None, today) # None = null value for a{n}_updated_at
#             else:
#                 params = (matric_no, course_code, "-", "-", "-", None, None, None)

#             try:
#                 cur.execute(insert_sql, params)
#                 inserted += 1
#             except Exception as ex:
#                 # If duplicate due to UC_Student_Course, skip; else re-raise
#                 # SQLState 23000-ish: unique constraint. For portability, re-check existence.
#                 cur.execute(
#                     "SELECT 1 FROM STUDENT_SCORE WHERE MATRIC_NO=? AND COURSE_CODE=?",
#                     (matric_no, course_code)
#                 )
#                 if cur.fetchone():
#                     skipped += 1
#                 else:
#                     raise

#         conn.commit()
#         cur.close()
#         conn.close()
#         return (inserted, skipped)
#     except Exception:
#         if conn:
#             conn.rollback()
#             try:
#                 cur.close()
#             except Exception:
#                 pass
#             conn.close()
#         raise


# I will slap perplexity if the new function doesnt work
@app.route('/api/add-student', methods=['POST'])
def add_student():
    conn = None
    try:
        data = request.json or {}

        required = ["STUDENT_NAME", "COHORT", "SEM", "CU_ID", "IC_NO", "MATRIC_NO", "PROGRAM_CODE"]
        missing = [f for f in required if not str(data.get(f) or "").strip()]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        student_name = str(data["STUDENT_NAME"]).strip()
        program_code = str(data["PROGRAM_CODE"]).strip()

        raw_cohort = data["COHORT"]
        if isinstance(raw_cohort, str):
            try:
                cohort_date = datetime.strptime(raw_cohort.strip(), "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "COHORT must be YYYY-MM-DD"}), 400
        elif isinstance(raw_cohort, date):
            cohort_date = raw_cohort
        else:
            return jsonify({"error": "COHORT must be a date string 'YYYY-MM-DD'"}), 400

        sem_str = str(data["SEM"]).strip()

        try:
            cu_id_int = int(str(data["CU_ID"]).strip())
        except ValueError:
            return jsonify({"error": "CU_ID must be an integer"}), 400

        ic_enc = encrypt_ic(str(data["IC_NO"]).strip())
        mobile = (data.get("MOBILE_NO") or "-").strip()
        email = (data.get("EMAIL") or "-").strip()
        bm = (data.get("BM") or "-").strip()
        english = (data.get("ENGLISH") or "-").strip()
        entry_q = (data.get("ENTRY_Q") or "-").strip()
        matric_no = str(data["MATRIC_NO"]).strip()
        student_status = "Active"

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM STUDENTS WHERE MATRIC_NO = ?", (matric_no,))
        if cursor.fetchone():
            return jsonify({"error": "Matric number already exists"}), 400

        insert_student_query = """
        INSERT INTO STUDENTS (
          STUDENT_NAME, COHORT, SEM, CU_ID, IC_NO,
          MOBILE_NO, EMAIL, BM, ENGLISH, ENTRY_Q,
          MATRIC_NO, STUDENT_STATUS
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(
            insert_student_query,
            (
                student_name, cohort_date, sem_str, cu_id_int, ic_enc,
                mobile, email, bm, english, entry_q,
                matric_no, student_status
            )
        )

        # Fetch courses based on the program code
        cursor.execute(
            """
            SELECT COURSE_CODE, COURSE_CLASSIFICATION
            FROM COURSE_STRUCTURE
            WHERE PROGRAM_CODE = ?
            """,
            (program_code,)
        )
        courses = cursor.fetchall()
        if not courses:
            conn.rollback()
            return jsonify({"error": f"No courses found for program: {program_code}"}), 400

        # Seed scores
        insert_score_query = """
        INSERT INTO STUDENT_SCORE (
            MATRIC_NO, COURSE_CODE, ATTEMPT_1, ATTEMPT_2, ATTEMPT_3,
            A1_UPDATED_AT, A2_UPDATED_AT, A3_UPDATED_AT
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        today = date.today()

        for course_code, classification in courses:
            is_mpu = bool(classification) and str(classification).upper().startswith("MPU")
            if is_mpu:
                params = (matric_no, course_code, "-", "-", "N/A", None, None, today)
            else:
                params = (matric_no, course_code, "-", "-", "-", None, None, None)
            cursor.execute(insert_score_query, params)

        conn.commit()
        return jsonify({"message": f"Student {student_name} added successfully with {len(courses)} courses"}), 201

    except Exception as e:
        logging.error(f"Failed to add student: {str(e)}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.route('/api/cohorts', methods=['GET'])
def list_cohorts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""SELECT 
                    DISTINCT YEAR(COHORT) AS YEAR
                    FROM STUDENTS
                    WHERE COHORT IS NOT NULL
                    ORDER BY YEAR DESC""")
        rows = cursor.fetchall()
        years = [str(r[0]) for r in rows if r and r[0] is not None]
        return jsonify(years)
    
    except Exception as e:
        app.logger.exception("Failed to fetch cohorts")
        return jsonify({"error": "Failed to fetch cohorts"}), 500
    
    finally:
        try:
            if cursor is not None:
                cursor.close()
        
        finally:
            if conn is not None:
                conn.close()

@app.route('/api/check-first-user', methods=['GET'])
def check_first_user():
    # Check if SHARED_2FA_SECRET exists in the environment variables
    is_first_user = not bool(os.getenv('SHARED_2FA_SECRET'))
    return jsonify({"isFirstUser": is_first_user})

@app.route('/api/check-setup', methods=['GET'])
def check_setup():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Check if any users exist
        cursor.execute("SELECT COUNT(*) FROM USERS")
        user_count = cursor.fetchone()[0]
        
        # Check if admin exists
        cursor.execute("SELECT COUNT(*) FROM USERS WHERE IS_ADMIN = 1")
        admin_exists = cursor.fetchone()[0] > 0
        needs_2fa_setup = False

        # Check 2FA status if admin exists
        if admin_exists:
            cursor.execute("""
                SELECT TOP 1 HAS_VERIFIED_2FA
                FROM USERS
                WHERE IS_ADMIN = 1
                ORDER BY CREATED_AT
            """)
            result = cursor.fetchone()

            if result:
                needs_2fa_setup = not bool(result[0])

        return jsonify({
            "shouldSetup": user_count == 0,
            "needs2FASetup": needs_2fa_setup,
            "adminExists": admin_exists,
            "userCount": user_count
        })

    except Exception as e:
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": "Database error"}), 500
    finally:
        conn.close()

@app.route('/api/course-structure', methods=['GET'])
def get_course_structure():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COURSE_CODE,
                MODULE,
                COURSE_CLASSIFICATION,
                PRE_CO_REQ,
                CREDIT_HOUR,
                LECT_HR_WK,
                TUT_HR_WK,
                LAB_HR_WK,
                BL_HR_WK,
                CU_CW_CREDITS,
                CU_EX_CREDITS,
                COURSE_LEVEL,
                LECTURER,
                COURSE_STATUS,
                COURSE_YEAR,
                PROGRAM_CODE
            FROM COURSE_STRUCTURE
            ORDER BY COURSE_YEAR, COURSE_CODE
        """)
        
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        data = [dict(zip(columns, row)) for row in rows]

        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/course-structure', methods=['POST'])
@jwt_required()
def add_course_structure():
    try:
        data = request.get_json()
        
        required_fields = ['COURSE_CODE', 'MODULE', 'COURSE_YEAR', 'PROGRAM_CODE', 'COURSE_STATUS', 'CREDIT_HOUR', 'COURSE_LEVEL']
        if not all(field in data and data[field] not in [None, ''] for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        course_code = data.get('COURSE_CODE')
        module = data.get('MODULE')
        course_classification = data.get('COURSE_CLASSIFICATION')
        pre_co_req = data.get('PRE_CO_REQ')
        credit_hour = data.get('CREDIT_HOUR')
        lect_hr_wk = data.get('LECT_HR_WK')
        tut_hr_wk = data.get('TUT_HR_WK')
        lab_hr_wk = data.get('LAB_HR_WK')
        bl_hr_wk = data.get('BL_HR_WK')
        cu_cw_credits = data.get('CU_CW_Credits')
        cu_ex_credits = data.get('CU_EX_Credits')
        course_level = data.get('COURSE_LEVEL')
        lecturer = data.get('LECTURER')
        course_year = data.get('COURSE_YEAR')
        course_status = data.get('COURSE_STATUS')
        program_code = data.get('PROGRAM_CODE')
        
        priority = None
        if course_year == 'Compulsory':
            priority = 0
        elif course_year in ['Year 1', 'Year 2', 'Year 3']:
            try:
                priority = int(course_year.split(' ')[1])
            except (ValueError, IndexError):
                return jsonify({'error': 'Invalid Course Year format for priority calculation'}), 400
        else:
            return jsonify({'error': 'Invalid Course Year value'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT 1 FROM COURSE_STRUCTURE WHERE COURSE_CODE = ? AND PROGRAM_CODE = ?", (course_code, program_code))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Course code already exists for this program'}), 409

        query = """
        INSERT INTO COURSE_STRUCTURE (
            COURSE_CODE, MODULE, COURSE_CLASSIFICATION, PRE_CO_REQ, 
            CREDIT_HOUR, LECT_HR_WK, TUT_HR_WK, LAB_HR_WK, 
            BL_HR_WK, CU_CW_Credits, CU_EX_Credits, 
            COURSE_LEVEL, LECTURER, COURSE_YEAR, COURSE_STATUS, 
            PROGRAM_CODE, COURSE_PRIORITY
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = (
            course_code, module, course_classification, pre_co_req, 
            credit_hour, lect_hr_wk, tut_hr_wk, lab_hr_wk, 
            bl_hr_wk, cu_cw_credits, cu_ex_credits, 
            course_level, lecturer, course_year, course_status, 
            program_code, priority
        )
        
        cursor.execute(query, params)
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Course added successfully'}), 201

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/course-structure', methods=['PUT'])
@jwt_required()
def update_course_structure():
    try:
        data = request.get_json()
        
        original_code = data.get('original_course_code')
        original_program = data.get('original_program_code')

        if not original_code or not original_program:
            return jsonify({'error': 'Original course identifiers are missing'}), 400

        course_year = data.get('COURSE_YEAR')
        priority = None
        if course_year == 'Compulsory':
            priority = 0
        elif course_year in ['Year 1', 'Year 2', 'Year 3']:
            priority = int(course_year.split(' ')[1])
        else:
            return jsonify({'error': 'Invalid Course Year'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
        UPDATE COURSE_STRUCTURE SET
            MODULE = ?, COURSE_CLASSIFICATION = ?, PRE_CO_REQ = ?, 
            CREDIT_HOUR = ?, LECT_HR_WK = ?, TUT_HR_WK = ?, LAB_HR_WK = ?, 
            BL_HR_WK = ?, CU_CW_Credits = ?, CU_EX_Credits = ?, 
            COURSE_LEVEL = ?, LECTURER = ?, COURSE_YEAR = ?, COURSE_STATUS = ?, 
            COURSE_PRIORITY = ?
        WHERE COURSE_CODE = ? AND PROGRAM_CODE = ?
        """
        
        params = (
            data.get('MODULE'), data.get('COURSE_CLASSIFICATION'), data.get('PRE_CO_REQ'),
            data.get('CREDIT_HOUR'), data.get('LECT_HR_WK'), data.get('TUT_HR_WK'), data.get('LAB_HR_WK'),
            data.get('BL_HR_WK'), data.get('CU_CW_CREDITS'), data.get('CU_EX_CREDITS'),
            data.get('COURSE_LEVEL'), data.get('LECTURER'), data.get('COURSE_YEAR'), data.get('COURSE_STATUS'),
            priority,
            original_code, original_program
        )
        
        cursor.execute(query, params)
        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({'error': 'Course not found or no changes made'}), 404
        
        cursor.close()
        conn.close()
        return jsonify({'message': 'Course updated successfully'}), 200

    except Exception as e:
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/course-structure/<string:course_code>/<string:program_code>', methods=['DELETE'])
@jwt_required()
def delete_course_structure(course_code, program_code):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM COURSE_STRUCTURE WHERE COURSE_CODE = ? AND PROGRAM_CODE = ?",
            (course_code, program_code)
        )
        conn.commit()
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Course not found'}), 404
        
        cursor.close()
        conn.close()
        return jsonify({'message': 'Course deleted successfully'}), 200
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({'error': str(e)}), 500

# @app.route('/api/course-versions', methods=['GET'])
# def get_course_versions():
#     try:
#         conn = get_db_connection()
#         cursor = conn.cursor()
#         cursor.execute("SELECT DISTINCT COURSE_VERSION FROM COURSE_STRUCTURE ORDER BY COURSE_VERSION DESC")
#         versions = [row[0] for row in cursor.fetchall()]
#         cursor.close()
#         conn.close()
#         return jsonify({"versions": versions}), 200
#     except Exception as e:
#         logging.error(f"Failed to fetch course versions: {str(e)}")
#         return jsonify({"error": str(e)}), 500

@app.route('/api/course-structure/options', methods=['GET'])
def course_structure_options():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COURSE_CODE AS code,
                MODULE AS module,
                COURSE_STATUS AS status
            FROM COURSE_STRUCTURE
            WHERE COURSE_CLASSIFICATION = 'Compulsory'
              AND COURSE_CODE NOT LIKE 'MPU%'
            ORDER BY COURSE_CODE
        """)
        cols = [c[0] for c in cursor.description]
        rows = cursor.fetchall()
        data = [dict(zip(cols, r)) for r in rows]
        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-list/internship', methods=['POST'])
def generate_internship_list():
    payload = request.get_json(silent=True) or {}
    course_code = (payload.get('courseCode') or '').strip()
    session = (payload.get('session') or '').strip()
    if not course_code or not session:
        return jsonify({'error': 'courseCode and session are required'}), 400
    data = fetch_internship_list(course_code, session)
    return jsonify({'rows': data}), 200

@app.route('/api/generate-list/internship/pdf', methods=['POST'])
@cross_origin(origins=["http://localhost:5173"], supports_credentials=True)
def generate_internship_list_pdf():
    try:
        payload = request.get_json(silent=True) or {}
        course_code = (payload.get('courseCode') or '').strip()
        session = (payload.get('session') or '').strip()
        if not course_code or not session:
            return jsonify({'error': 'courseCode and session are required'}), 400

        rows = fetch_internship_list(course_code, session)  # your shared helper that decrypts IC_NO
        html = render_template("internship_list.html", course_code=course_code, session=session, rows=rows)

        # 2) Use temp file + from_file (more stable on Windows)
        tmpdir = tempfile.gettempdir()
        html_path = os.path.join(tmpdir, "internship_list_preview.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)

        options = {
            "page-size": "A4",
            "margin-top": "12mm",
            "margin-right": "12mm",
            "margin-bottom": "14mm",
            "margin-left": "12mm",
            "encoding": "UTF-8",
            "enable-smart-shrinking": None,
            "no-stop-slow-scripts": None,
            "print-media-type": None,
            "enable-local-file-access": None,  # allow loading local HTML file
        }

        pdf_bytes = pdfkit.from_file(html_path, False, options=options, configuration=PDFKIT_CONFIG)
        filename = f"internship_list_{course_code}_{session}.pdf"
        return Response(
            pdf_bytes,
            mimetype="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        # Log the exact exception for visibility
        current_app.logger.exception("Internship PDF generation failed")
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-list/mentorship', methods=['POST'])
def generate_mentorship_list():
    payload = request.get_json(silent=True) or {}
    session = (payload.get('session') or '').strip()
    if not session:
        return jsonify({'error': 'session is required'}), 400
    data = fetch_mentorship_list(session)
    return jsonify({'rows': data}), 200

    # except Exception as e:
    #     current_app.logger.exception("Mentorship list generation failed")
    #     return jsonify({'error': str(e)}), 500


@app.route('/api/generate-list/mentorship/pdf', methods=['POST'])
@cross_origin(origins=["http://localhost:5173"], supports_credentials=True)
def generate_mentorship_list_pdf():
    try:
        payload = request.get_json(silent=True) or {}
        session = (payload.get('session') or '').strip()
        if not session:
            return jsonify({'error': 'session is required'}), 400
        
        # Render mentorship PDF
        rows = fetch_mentorship_list(session)
        html = render_template("mentorship_list.html", session=session, rows=rows)

        # Use the same options/config as internship
        options = {
            "page-size": "A4",
            "margin-top": "12mm",
            "margin-right": "12mm",
            "margin-bottom": "14mm",
            "margin-left": "12mm",
            "encoding": "UTF-8",
            "enable-smart-shrinking": None,
            "no-stop-slow-scripts": None,
            "print-media-type": None,
            "enable-local-file-access": None,
        }
        # If using from_file with a temp .html (Windows stability), do that here as well
        pdf_bytes = pdfkit.from_string(html, False, options=options, configuration=PDFKIT_CONFIG)
        filename = f"mentorship_list_{session}.pdf"

        return Response(
            pdf_bytes,
            mimetype="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        current_app.logger.exception("Mentorship PDF generation failed")
        return jsonify({'error': str(e)}), 500

# @app.route('/api/students', methods=['GET'])
# def get_students():
#     matric_no = request.args.get('matric_no')
    
#     conn = get_db_connection()
#     cursor = conn.cursor()
    
#     if matric_no:
#         # Fetch single student by MATRIC_NO
#         query = "SELECT * FROM STUDENTS WHERE MATRIC_NO = ?"
#         cursor.execute(query, (matric_no,))
#     else:
#         # Fetch all students
#         query = "SELECT * FROM STUDENTS ORDER BY STUDENT_NAME"
#         cursor.execute(query)
    
#     columns = [column[0] for column in cursor.description]
#     results = cursor.fetchall()
    
#     students = [dict(zip(columns, row)) for row in results]
    
#     cursor.close()
#     conn.close()
    
#     return jsonify(students)

@app.route('/api/student-score/sessions/mentorship', methods=['GET'])
def student_score_mentorship_sessions():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Union of distinct R-prefixed values from all three attempts, no course filter
        cursor.execute("""
            SELECT DISTINCT UPPER(LTRIM(RTRIM(ATTEMPT_1))) AS v
              FROM STUDENT_SCORE
             WHERE LEFT(UPPER(LTRIM(RTRIM(ATTEMPT_1))), 1) = 'R'
            UNION
            SELECT DISTINCT UPPER(LTRIM(RTRIM(ATTEMPT_2))) AS v
              FROM STUDENT_SCORE
             WHERE LEFT(UPPER(LTRIM(RTRIM(ATTEMPT_2))), 1) = 'R'
            UNION
            SELECT DISTINCT UPPER(LTRIM(RTRIM(ATTEMPT_3))) AS v
              FROM STUDENT_SCORE
             WHERE LEFT(UPPER(LTRIM(RTRIM(ATTEMPT_3))), 1) = 'R'
        """)
        # Searching for 'r' in attempt for MPU courses as older score gets overwritten after exceeding 2 attempts

        rows = cursor.fetchall()
        values = [r[0] for r in rows if isinstance(r[0], str) and r[0].strip()]

        cursor.close()
        conn.close()
        return jsonify(values), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/student-score/sessions/internship', methods=['GET'])
def student_score_internship_sessions():
    try:
        course_code = (request.args.get('courseCode') or '').strip()
        if not course_code:
            return jsonify({'error': 'courseCode is required'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # DISTINCT + UNION for ATTEMPT_1/2/3
        cursor.execute("""
            SELECT DISTINCT ATTEMPT_1 AS v 
              FROM STUDENT_SCORE 
             WHERE COURSE_CODE = ? AND LEFT(ATTEMPT_1, 1) = 'S'
            UNION
            SELECT DISTINCT ATTEMPT_2 AS v 
              FROM STUDENT_SCORE 
             WHERE COURSE_CODE = ? AND LEFT(ATTEMPT_2, 1) = 'R'
            UNION
            SELECT DISTINCT ATTEMPT_3 AS v 
              FROM STUDENT_SCORE 
             WHERE COURSE_CODE = ? AND LEFT(ATTEMPT_3, 1) = 'R'
        """, (course_code, course_code, course_code))

        rows = cursor.fetchall()
        values = [r[0] for r in rows if isinstance(r[0], str) and r[0].strip()]

        cursor.close()
        conn.close()
        return jsonify(values), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Protected Homepage Endpoint
@app.route('/api/home', methods=['GET'])
@jwt_required()
def home():
    current_user = get_jwt_identity()
    return jsonify({"message": f"Welcome {current_user}!"}) # Currently not displaying current_user, the welcome text is static (defined in jsx file)

@app.route('/api/import', methods=['POST'])
@jwt_required()
def import_excel():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    selected_sheet = request.form.get('selectedSheet')
    is_legacy = request.form.get('isLegacy','false').lower() == 'true' # <<< parse boolean safely
    program_code = request.form.get('program')
    user_email = get_jwt_identity()

    if selected_sheet not in SHEET_INFO_MAP:
        return jsonify({"error": "Invalid sheet selection"}), 400
    
    if selected_sheet == "Course Structure":
        if not program_code:
            return jsonify({"error": "Missing program code"})

    filename = secure_filename(file.filename)
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)

    # sanitize email so it’s safe as a folder name
    base_csv_folder = os.path.join(os.getcwd(), "csv files")
    os.makedirs(base_csv_folder, exist_ok=True)

    user_name = user_email.split("@")[0]
    safe_name = secure_filename(user_name)
    user_folder = os.path.join(base_csv_folder, safe_name)
    os.makedirs(user_folder, exist_ok=True)

    sheet_info = SHEET_INFO_MAP[selected_sheet]
    if selected_sheet == "Course Structure":
        output_files = process_course_str(file_path, sheet_info, user_folder, is_legacy=is_legacy) # <-- Edited here

        # Import into DB using existing function
        if output_files:
            try:
                # Assuming only one CSV file is returned for Course Structure
                csv_file = output_files[0]
                insert_count, update_count, error_count = import_course_structure(csv_file, program_code)

                return jsonify({
                    "message": f"{selected_sheet} processed and imported successfully",
                    "inserted": insert_count,
                    "updated": update_count,
                    "errors": error_count,
                    "files": output_files
                })
            
            except Exception as e:
                return jsonify({"error": f"Import into DB failed: {str(e)}"}), 500

    else:
        output_files = process_student_datasheet(file_path, sheet_info, user_folder)

        try:
            results = import_student_data(file_path, sheet_info, user_folder)
            if not results:
                return jsonify({"error": f"Failed to process {selected_sheet}"}), 500

            return jsonify({
                "message": f"{selected_sheet} processed and imported successfully",
                "files": results["files"],
                "students": results["students"],
                "scores": results["scores"]
            })
        except Exception as e:
            return jsonify({"error": f"Import into DB failed: {str(e)}"}), 500

    return jsonify({"error": f"Failed to process {selected_sheet}"}), 500

# Login Endpoints (Two-Step Flow)
@app.route('/api/login/verify-credentials', methods=['POST'])
def verify_credentials():
    """Step 1: Verify email and password."""
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db_connection()
    try:
        user = conn.execute("""
            SELECT PASSWORD_HASH, SALTED_PASSWORD FROM USERS 
            WHERE EMAIL = ?
        """, (email,)).fetchone()

        if not user or encrypt_pw(user[1], password) != user[0]:
            return jsonify({"error": "Invalid credentials"}), 401

        # Credentials are valid, frontend will now prompt for 2FA
        return jsonify({"message": "Credentials verified"}), 200
    finally:
        conn.close()

@app.route('/api/login/verify-2fa', methods=['POST'])
def verify_2fa_and_login():
    """Step 2: Verify 2FA code and issue token."""
    data = request.get_json()
    email = data.get('email', '').lower().strip()
    two_fa_code = data.get('twoFACode', '').strip()

    # if not email or not two_fa_code:
    #     return jsonify({"error": "Email and 2FA code are required"}), 400

    # # Ensure user exists before proceeding
    # conn = get_db_connection()
    # try:
    #     user_exists = conn.execute("SELECT 1 FROM USERS WHERE EMAIL = ?", (email,)).fetchone()
    #     if not user_exists:
    #         return jsonify({"error": "User not found"}), 404
    # finally:
    #     conn.close()

    # Verify 2FA code
    shared_secret = get_latest_env('SHARED_2FA_SECRET')
    if not shared_secret:
        return jsonify({"error": "2FA secret not configured on server"}), 500

    try:
        totp = pyotp.TOTP(shared_secret)
        if not totp.verify(two_fa_code, valid_window=1):
            return jsonify({"error": "Invalid 2FA code"}), 400
    except Exception as e:
        logging.error(f"2FA verification error: {str(e)}")
        return jsonify({"error": "2FA processing failed"}), 500

    # On success, generate JWT
    access_token = create_access_token(identity=email)
    refresh_token = create_refresh_token(identity=email)

    response = jsonify({"message": "Login successful"})
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response

@app.route('/api/token/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    response = jsonify({'message': 'Token refreshed'})
    set_access_cookies(response, access_token)
    return response

@app.route('/api/logout', methods=['POST'])
def logout():
    response = jsonify({'message': 'Logout successful'})
    unset_jwt_cookies(response)
    return response

@app.route('/api/import-marksheet', methods=['POST'])
@cross_origin(origins=["http://localhost:5173"])
def import_marksheet_scores():
    if 'file' not in request.files:
        return jsonify({"error": "file is required"}), 400
    f = request.files['file']
    if not f.filename.lower().endswith('.xlsm'):
        return jsonify({"error": "only .xlsm allowed"}), 400

    import tempfile, os
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsm") as tmpf:
            f.save(tmpf.name)
            tmp_path = tmpf.name
        result = import_marksheet(tmp_path)  # function below uses per-sheet reads
        return jsonify(result), 200
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

#   Not using yet!
@app.route('/admin/invite-token', methods=['GET'])
@jwt_required()
def generate_invite_token():
    current_user = get_jwt_identity()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT IS_ADMIN FROM USERS WHERE EMAIL = ?", (current_user,))
    if not cursor.fetchone()[0]:
        return jsonify({"error": "Admin access required"}), 403

    token = create_access_token(
        identity={"purpose": "invite"},
        expires_delta=timedelta(hours=24))
    
    return jsonify({
        "inviteToken": token,
        "sharedSecret": os.getenv('SHARED_2FA_SECRET')
    })

# Registration Endpoint
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        logging.debug(f"Received registration data: {data}")  # Log incoming data
        print(f"Received registration data: {data}")
        name = data.get('name', '').strip()
        email = data.get('email', '').lower().strip()
        password = data.get('password', '').strip()
        confirm_password = data.get('confirmPassword', '').strip()  # <-- FIXED
        two_fa_code = data.get('twoFACode', '').strip()

        shared_secret = get_latest_env('SHARED_2FA_SECRET')    # Reloads env variables

        # Validate input
        if not all([name, email, password, confirm_password]):
            logging.error("All fields are required.")
            return jsonify({"error": "All fields are required"}), 400

        # Check if first registration
        #is_first_user = False
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if first user
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        is_first_user = (user_count == 0) 
        
        # Verify 2FA code
        if not is_first_user:
            if not two_fa_code:
                return jsonify({"error": "2FA code is required"}), 400
            totp = pyotp.TOTP(shared_secret)
            if not totp.verify(two_fa_code, valid_window=1):
                logging.error("Invalid 2FA code.")
                conn.close()
                return jsonify({"error": "Invalid 2FA code"}), 400

        # Check if email exists
        cursor.execute("SELECT email FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            logging.error(f"Email already registered: {email}")
            return jsonify({"error": "Email already registered"}), 409

        # Create user
        salt = uuid.uuid4().hex
        created_at = datetime.now()
        # Regular users are not admins
        is_admin = 0
        has_verified_2fa = 1
        
        cursor.execute("""
            INSERT INTO users 
            (name, email, password_hash, salted_password, is_admin, has_verified_2fa, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            email,
            encrypt_pw(salt, password),
            salt,
            is_admin,
            has_verified_2fa,
            created_at
        ))

        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Registration successful"}), 201

    except pyodbc.Error as e:
        logging.error(f"Database error: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/setup', methods=['POST'])
def setup():
    try:
        data = request.get_json()
        email = data.get('email', '').lower().strip()

        if not email:
            # Email is needed for the provisioning URI
            return jsonify({"error": "Email is required for 2FA setup"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE IS_ADMIN = 1")
        admin_count = cursor.fetchone()[0]
        conn.close()

        is_first_user = admin_count == 0
        
        secret = os.getenv('SHARED_2FA_SECRET')
        if is_first_user and not secret:
            # This is the very first admin setup, generate a new secret
            secret = pyotp.random_base32()
        elif not secret:
            # This should not happen if an admin already exists, but as a fallback
            logging.error("SHARED_2FA_SECRET not found for a new user setup when admin exists.")
            return jsonify({"error": "Server 2FA not configured."}), 500

        totp = pyotp.TOTP(secret)
        qr_url = totp.provisioning_uri(name=email, issuer_name="FYP")

        # Return the details needed for frontend 2FA setup
        return jsonify({
            "qrUrl": qr_url,
            "manualCode": secret,
            "secret": secret  # Pass the secret to the client to be returned for verification
        }), 200

    except Exception as e:
        logging.error(f"Error in /api/setup (2FA initiation): {str(e)}")
        return jsonify({"error": "Server error during 2FA initiation"}), 500

@app.route('/api/students', methods=['GET'])
def get_students_info():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                STUDENT_ID,
                STUDENT_NAME,
                COHORT,
                SEM,
                CU_ID,
                IC_NO,
                MOBILE_NO,
                EMAIL,
                BM,
                ENGLISH,
                ENTRY_Q,
                MATRIC_NO,
                STUDENT_STATUS
            FROM STUDENTS
            ORDER BY STUDENT_NAME, STUDENT_STATUS
        """)
        
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        #data = [dict(zip(columns, row)) for row in rows]
        data = []
        for row in rows:
            row_dict = dict(zip(columns, row))

            encrypted_ic = row_dict.get('IC_NO')
            if encrypted_ic:
                try:
                    row_dict['IC_NO'] = decrypt_ic(encrypted_ic)
                except Exception as decrypt_error:
                    row_dict['IC_NO'] = None
                
                data.append(row_dict)

        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/students-scores', methods=['GET'])
def get_students_scores():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                student.STUDENT_NAME,
                student.COHORT,
                student.SEM,
                student.CU_ID,
                score.SCORE_ID,
                score.MATRIC_NO,
                score.COURSE_CODE,
                score.ATTEMPT_1,
                score.ATTEMPT_2,
                score.ATTEMPT_3
            FROM STUDENTS AS student
            LEFT JOIN STUDENT_SCORE AS score
            ON score.MATRIC_NO = student.MATRIC_NO
            ORDER BY
            LTRIM(RTRIM(student.STUDENT_NAME)), score.COURSE_CODE;
        """)
        #student.STUDENT_NAME, score.COURSE_CODE;
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/students-scores', methods=['PUT'])
@jwt_required()
def update_student_scores():
    try:
        data = request.get_json()
        matric_no = data.get('MATRIC_NO')
        courses = data.get('courses')

        if not matric_no or not courses:
            return jsonify({'error': 'Missing matric_no or courses data'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        for course_code, new_attempts in courses.items():
            new_attempt1, new_attempt2, new_attempt3 = new_attempts
            
            # Fetch current record to compare
            cursor.execute(
                """
                SELECT ATTEMPT_1, ATTEMPT_2, ATTEMPT_3,
                       A1_UPDATED_AT, A2_UPDATED_AT, A3_UPDATED_AT
                FROM STUDENT_SCORE
                WHERE MATRIC_NO = ? AND COURSE_CODE = ?
                """,
                (matric_no, course_code)
            )
            current_record = cursor.fetchone()

            if current_record:
                current_attempt1, current_attempt2, current_attempt3, \
                current_a1_updated_at, current_a2_updated_at, current_a3_updated_at = current_record

                update_set_parts = []
                update_values = []

                # Always include all attempts in the SET clause, but only update _UPDATED_AT if changed
                update_set_parts.append("ATTEMPT_1 = ?")
                update_values.append(new_attempt1)
                if str(new_attempt1) != str(current_attempt1):
                    update_set_parts.append("A1_UPDATED_AT = GETDATE()")
                else:
                    update_set_parts.append("A1_UPDATED_AT = ?") # Keep existing timestamp
                    update_values.append(current_a1_updated_at)

                update_set_parts.append("ATTEMPT_2 = ?")
                update_values.append(new_attempt2)
                if str(new_attempt2) != str(current_attempt2):
                    update_set_parts.append("A2_UPDATED_AT = GETDATE()")
                else:
                    update_set_parts.append("A2_UPDATED_AT = ?")
                    update_values.append(current_a2_updated_at)

                update_set_parts.append("ATTEMPT_3 = ?")
                update_values.append(new_attempt3)
                if str(new_attempt3) != str(current_attempt3):
                    update_set_parts.append("A3_UPDATED_AT = GETDATE()")
                else:
                    update_set_parts.append("A3_UPDATED_AT = ?")
                    update_values.append(current_a3_updated_at)

                update_query = f"""
                    UPDATE STUDENT_SCORE
                    SET {', '.join(update_set_parts)}
                    WHERE MATRIC_NO = ? AND COURSE_CODE = ?
                """
                final_params = update_values + [matric_no, course_code]
                cursor.execute(update_query, final_params)
            else:
                # This case should ideally not happen if the student was created correctly
                # but as a fallback, we can insert.
                # For insert, all updated_at fields are set to GETDATE() if the attempt is provided, else NULL
                today = datetime.now()
                cursor.execute("""
                    INSERT INTO STUDENT_SCORE (MATRIC_NO, COURSE_CODE, ATTEMPT_1, ATTEMPT_2, ATTEMPT_3, A1_UPDATED_AT, A2_UPDATED_AT, A3_UPDATED_AT)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    matric_no, course_code, new_attempt1, new_attempt2, new_attempt3,
                    today if new_attempt1 is not None else None,
                    today if new_attempt2 is not None else None,
                    today if new_attempt3 is not None else None
                ))



        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Scores updated successfully'}), 200

    except Exception as e:
        # Log the error
        current_app.logger.error(f"Failed to update scores: {str(e)}")
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/students-scores-by-cohort', methods=['GET'])
def get_students_scores_by_cohort():
    year = request.args.get('year', type=int)
    if not year:
        return jsonify({'error': 'year is required'}), 400

    # Build a DATE string for the cohort anchor
    cohort_date = f"{year}-01-01"  # adjust month if intake starts later

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        query = """
        DECLARE @cohortDate DATE = ?;

        WITH CleanStructure AS (
          SELECT DISTINCT
            cs.COURSE_CODE,
            cs.MODULE,
            cs.COURSE_CLASSIFICATION,
            cs.COURSE_LEVEL,
            cs.COURSE_STATUS,
            cs.COURSE_PRIORITY,
            cs.COURSE_VERSION
          FROM COURSE_STRUCTURE cs
          WHERE cs.COURSE_VERSION IS NOT NULL
        ),
        VersionWindows AS (
          SELECT
            c.COURSE_CODE,
            c.MODULE,
            c.COURSE_CLASSIFICATION,
            c.COURSE_LEVEL,
            c.COURSE_STATUS,
            c.COURSE_PRIORITY,
            c.COURSE_VERSION AS version_start,
            LEAD(c.COURSE_VERSION) OVER (
              PARTITION BY c.COURSE_CODE
              ORDER BY c.COURSE_VERSION
            ) AS next_version_start
          FROM CleanStructure c
        ),
        ApplicableCourses AS (
        SELECT
            vw.COURSE_CODE,
            vw.MODULE,
            vw.COURSE_CLASSIFICATION,
            vw.COURSE_LEVEL,
            vw.COURSE_STATUS,
            vw.COURSE_PRIORITY
        FROM VersionWindows vw
        WHERE @cohortDate >= vw.version_start
            AND @cohortDate < COALESCE(vw.next_version_start, '9999-12-31')
        ),
        CohortFiltered AS (
        SELECT
            s.MATRIC_NO,
            s.STUDENT_NAME,
            s.SEM,
            s.CU_ID,
            YEAR(s.COHORT) AS COHORT_YEAR
        FROM STUDENTS s
        WHERE s.COHORT IS NOT NULL
            AND YEAR(s.COHORT) = YEAR(@cohortDate)
        )
        SELECT
          st.STUDENT_NAME,
          CAST(YEAR(@cohortDate) AS INT) AS REQUEST_YEAR,
          st.COHORT_YEAR AS COHORT,
          st.SEM,
          st.CU_ID,
          ac.COURSE_CODE,
          sc.SCORE_ID,
          st.MATRIC_NO,
          sc.ATTEMPT_1,
          sc.ATTEMPT_2,
          sc.ATTEMPT_3
        FROM CohortFiltered st
        CROSS JOIN ApplicableCourses ac
        LEFT JOIN STUDENT_SCORE sc
          ON sc.MATRIC_NO = st.MATRIC_NO
         AND RTRIM(LTRIM(sc.COURSE_CODE)) = RTRIM(LTRIM(ac.COURSE_CODE))
        ORDER BY st.STUDENT_NAME, ac.COURSE_CODE;
        """

        # Bind a DATE string for @cohortDate
        cur.execute(query, (cohort_date,))
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return jsonify(rows), 200

    except Exception as e:
        import traceback, sys, logging
        logger = logging.getLogger(__name__)
        tb = "".join(traceback.format_exception(*sys.exc_info()))
        logger.error("cohort query failed: %s\n%s", str(e), tb)
        if conn:
            conn.close()
        return jsonify({'error': str(e)}), 500


######

@app.route('/api/students/<student_id>', methods=['DELETE'])
def delete_student(student_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Delete existing score records of the selected student first
        cursor.execute("""
        DELETE FROM STUDENT_SCORE
        WHERE MATRIC_NO = (
        SELECT MATRIC_NO FROM STUDENTS WHERE STUDENT_ID = ?)
        """, (student_id,))

        # Finally, delete the student info's record
        cursor.execute("""
            DELETE FROM STUDENTS WHERE STUDENT_ID = ?
            """, (student_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": "Student record deleted successfully"}), 200

    except Exception as e:
        print(f"Delete error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/students/<student_id>', methods=['PUT'])
def update_student(student_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400

        # Get the original matric_no for the student
        cursor.execute("SELECT MATRIC_NO FROM STUDENTS WHERE STUDENT_ID = ?", (student_id,))
        original_matric_no_row = cursor.fetchone()
        if not original_matric_no_row:
            return jsonify({'error': 'Student not found'}), 404
        original_matric_no = original_matric_no_row[0]

        new_matric_no = data.get('MATRIC_NO')
        is_matric_change = new_matric_no and new_matric_no != original_matric_no

        # Start transaction
        conn.autocommit = False

        if is_matric_change:
            cursor.execute("ALTER TABLE STUDENT_SCORE NOCHECK CONSTRAINT FK_Student_Score_Students")

        # Prepare and execute the update for the STUDENTS table
        update_fields = []
        values = []
        for key, value in data.items():
            if key.upper() == "IC_NO":
                value = encrypt_ic(value)
            update_fields.append(f"{key} = ?")
            values.append(value)
        
        if not update_fields:
            conn.rollback()
            return jsonify({'error': 'No fields to update'}), 400

        sql = f"UPDATE STUDENTS SET {', '.join(update_fields)} WHERE STUDENT_ID = ?"
        values.append(student_id)
        cursor.execute(sql, values)

        if is_matric_change:
            # Update the STUDENT_SCORE table
            cursor.execute("UPDATE STUDENT_SCORE SET MATRIC_NO = ? WHERE MATRIC_NO = ?", (new_matric_no, original_matric_no))
            
            # Re-enable the foreign key constraint
            cursor.execute("ALTER TABLE STUDENT_SCORE CHECK CONSTRAINT FK_Student_Score_Students")

        conn.commit()
        return jsonify({'message': 'Student updated successfully'}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.autocommit = True
            cursor.close()
            conn.close()
    
@app.route('/api/verify-2fa-setup', methods=['POST'])
def verify_admin_2fa_setup():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        email = data.get('email', '').lower().strip()
        password = data.get('password', '').strip()
        # confirm_password is validated on client, not needed here
        code = data.get('code', '').strip()
        secret = data.get('secret', '').strip()

        if not all([name, email, password, code, secret]):
            return jsonify({"error": "Missing required fields for final setup."}), 400

        # Verify the 2FA code first
        totp = pyotp.TOTP(secret)
        if not totp.verify(code, valid_window=1):
            return jsonify({"error": "Invalid 2FA code"}), 400

        # --- Code is valid, proceed with user creation ---
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Double-check if an admin already exists to prevent race conditions
        cursor.execute("SELECT COUNT(*) FROM users WHERE IS_ADMIN = 1")
        admin_count = cursor.fetchone()[0]
        is_first_user = admin_count == 0

        # Security check: if not the first user, the secret from client must match env
        if not is_first_user:
            env_secret = os.getenv('SHARED_2FA_SECRET')
            if not env_secret or env_secret != secret:
                return jsonify({"error": "Invalid 2FA secret."}), 400
        
        # Check if email is already registered
        cursor.execute("SELECT email FROM users WHERE email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "Email already registered"}), 409

        # If this is the first admin, persist the new secret to the .env file
        if is_first_user:
            update_env_secret(secret)

        # Create the user
        salt = uuid.uuid4().hex
        created_at = datetime.now()
        
        cursor.execute("""
            INSERT INTO users 
            (name, email, password_hash, SALTED_PASSWORD, is_admin, has_verified_2fa, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            name,
            email,
            encrypt_pw(salt, password),
            salt,
            1,  # The user being set up is the admin
            1,  # 2FA is verified at this point
            created_at
        ))
        conn.commit()
        conn.close()

        return jsonify({"message": "Admin account created successfully!"}), 201

    except Exception as e:
        logging.error(f"Error in /api/verify-2fa-setup (user creation): {str(e)}")
        if 'conn' in locals() and conn:
            conn.close()
        return jsonify({"error": "Server error during account finalization"}), 500
    
    # --- Admin Routes ---

@app.route('/api/admin/student-statuses', methods=['GET'])
@jwt_required()
def api_get_all_student_statuses():
    try:
        statuses = get_all_student_statuses()
        return jsonify(statuses)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/student-statuses', methods=['POST'])
@jwt_required()
def api_add_student_status():
    try:
        data = request.get_json()
        status_name = data.get('status_name')
        if not status_name:
            return jsonify({'error': 'status_name is required'}), 400
        add_student_status(status_name)
        return jsonify({'message': 'Student status added successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/student-statuses/<string:status_name>', methods=['PUT'])
@jwt_required()
def api_update_student_status(status_name):
    try:
        data = request.get_json()
        new_status_name = data.get('new_status_name')
        if not new_status_name:
            return jsonify({'error': 'new_status_name is required'}), 400
        update_student_status(status_name, new_status_name)
        return jsonify({'message': 'Student status updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/student-statuses/<string:status_name>', methods=['DELETE'])
@jwt_required()
def api_delete_student_status(status_name):
    try:
        delete_student_status(status_name)
        return jsonify({'message': 'Student status deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/programs', methods=['GET'])
@jwt_required()
def api_get_all_programs():
    try:
        programs = get_all_programs()
        return jsonify(programs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/programs', methods=['POST'])
@jwt_required()
def api_add_program():
    try:
        data = request.get_json()
        program_code = data.get('program_code')
        if not program_code:
            return jsonify({'error': 'program_code is required'}), 400
        add_program(program_code)
        return jsonify({'message': 'Program added successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/programs/<string:program_code>', methods=['PUT'])
@jwt_required()
def api_update_program(program_code):
    try:
        data = request.get_json()
        new_program_code = data.get('new_program_code')
        if not new_program_code:
            return jsonify({'error': 'new_program_code is required'}), 400
        update_program(program_code, new_program_code)
        return jsonify({'message': 'Program updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/programs/<string:program_code>', methods=['DELETE'])
@jwt_required()
def api_delete_program(program_code):
    try:
        delete_program(program_code)
        return jsonify({'message': 'Program deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Lecturer Routes ---

@app.route('/api/admin/lecturers', methods=['GET'])
@jwt_required()
def api_get_all_lecturers():
    try:
        lecturers = get_all_lecturers()
        return jsonify(lecturers)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/lecturers', methods=['POST'])
@jwt_required()
def api_add_lecturer():
    try:
        data = request.get_json()
        lecturer_name = data.get('lecturer_name')
        if not lecturer_name:
            return jsonify({'error': 'lecturer_name is required'}), 400
        add_lecturer(lecturer_name)
        return jsonify({'message': 'Lecturer added successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/lecturers/<string:lecturer_name>', methods=['PUT'])
@jwt_required()
def api_update_lecturer(lecturer_name):
    try:
        data = request.get_json()
        new_lecturer_name = data.get('new_lecturer_name')
        if not new_lecturer_name:
            return jsonify({'error': 'new_lecturer_name is required'}), 400
        update_lecturer(lecturer_name, new_lecturer_name)
        return jsonify({'message': 'Lecturer updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/lecturers/<string:lecturer_name>', methods=['DELETE'])
@jwt_required()
def api_delete_lecturer(lecturer_name):
    try:
        deactivate_lecturer(lecturer_name)
        return jsonify({'message': 'Lecturer deactivated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/students/status-counts', methods=['GET'])
def get_student_status_counts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT STUDENT_STATUS, COUNT(*) as count
            FROM STUDENTS
            GROUP BY STUDENT_STATUS
        """)
        
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        data = [dict(zip(columns, row)) for row in rows]

        cursor.close()
        conn.close()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    #port = find_free_port()
    #print(f"Running on port {port}")
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
    jwt = JWTManager(app)
    app.run(host='0.0.0.0', port= 5001, debug=True)

logging.info("Server started")