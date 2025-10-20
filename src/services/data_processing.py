# No longer using, mkdir handled in route /import
# CSV_FOLDER = "csv files"
# os.makedirs(CSV_FOLDER, exist_ok=True)  # Create if doesn't exist

import datetime, logging, os, pyodbc, re
from cryptography.fernet import Fernet
from datetime import date,datetime
from src.db.core import get_db_connection
from src.services.db_helpers import get_year_1_course_codes
from dotenv import load_dotenv
import pandas as pd



load_dotenv()
key = os.getenv("IC_ENCRYPTION_KEY")

if not key:
    key = Fernet.generate_key().decode()

    with open(".env", "a") as f:
        f.write(f"\nIC_ENCRYPTION_KEY = {key}")
    print("New IC encryption key generated, saving to .env file...")

cipher = Fernet(key.encode())

COURSE_SHEET_RE = re.compile(r"^([A-Za-z0-9][A-Za-z0-9\-_]{2,})\s*-\s*BCSCU$", re.IGNORECASE)

def encrypt_ic(plain_ic: str) -> str:
    return cipher.encrypt(plain_ic.encode()).decode()

def decrypt_ic(encrypted_ic: str) -> str:
    return cipher.decrypt(encrypted_ic.encode()).decode()

def process_student_datasheet(file_path, sheet_info, output_folder):
    sheet_name = sheet_info['name']

    def col_letter_to_index(col):
        index = 0
        for char in col.upper():
            index = index * 26 + (ord(char) - ord('A') + 1)
        return index - 1

    try:
        # 1) Read Excel with header=0 (keep row 1 as header for score logic)
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=0)

        # 2) Column helpers
        required_indices = [col_letter_to_index(col) for col in sheet_info['required']]
        student_start = col_letter_to_index(sheet_info['student_start_col'])
        student_end = col_letter_to_index(sheet_info['student_end_col'])
        matric_col_index = col_letter_to_index('M')  # student info up to M
        cohort_col_index = col_letter_to_index('D')

        # Ensure required columns exist
        if max(required_indices) >= len(df.columns):
            missing = [col for col, idx in zip(sheet_info['required'], required_indices) if idx >= len(df.columns)]
            print(f"❌ Missing required columns: {missing}")
            return False

        # 3) Base valid rows: required fields must exist (used for both student info and scores)
        valid_rows = df.iloc[:, required_indices].notna().all(axis=1)

        # -------------------------------
        # Student Personal Info
        # -------------------------------
        student_header = df.iloc[0, student_start:student_end+1].tolist()
        student_data = df.iloc[2:, student_start:student_end+1].copy()
        student_data = student_data.replace(r'^\s*$', pd.NA, regex=True)
        student_data = student_data.dropna(how='all')
        student_data.columns = [
            str(col).strip() if pd.notna(col) else f"Col_{chr(65+i)}"
            for i, col in enumerate(student_header, start=student_start)
        ]
        valid_rows_student = valid_rows[2:] & student_data.notna().any(axis=1)
        student_df = student_data[valid_rows_student].copy()

        # Extract 'Grad' column dynamically from the full DataFrame
        grad_col_name = None
        for col in df.columns:
            if str(col).strip().upper() == 'GRAD':
                grad_col_name = col
                break

        if grad_col_name is not None:
            try:
                # Get the column index
                grad_idx = df.columns.get_loc(grad_col_name)
                
                # Extract values from row 2 onward (matching student data range)
                grad_raw = df.iloc[2:, grad_idx].copy()
                
                # Apply the same valid_rows filter as student_df
                grad_filtered = grad_raw[valid_rows_student.values].reset_index(drop=True)
                
                # Add to student_df (ensure both are reset-indexed for alignment)
                student_df = student_df.reset_index(drop=True)
                student_df['Grad'] = grad_filtered.apply(
                    lambda x: str(x).strip() if pd.notna(x) and str(x).strip() not in ['', 'nan', 'None'] else '-'
                )
                print(f"✅ Extracted {(student_df['Grad'] != '-').sum()} Grad values from {sheet_name}")
            except Exception as e:
                print(f"⚠️ Error extracting Grad column: {e}, defaulting to '-'")
                student_df['Grad'] = '-'
        else:
            student_df['Grad'] = '-'
            print(f"⚠️ 'Grad' column not found in {sheet_name}, setting all GRADUATED_ON to '-'")

        if 'Cohort' in student_df.columns:
            try:
                student_df['Cohort'] = pd.to_datetime(student_df['Cohort']).dt.strftime('%d/%m/%Y')
            except Exception as e:
                print(f"⚠️ Could not format Cohort dates: {str(e)}")

        student_file = os.path.join(output_folder, f"{sheet_name}_Student.csv")
        student_df.to_csv(student_file, index=False, encoding='utf-8-sig')
        print(f"\n✅ Saved {len(student_df)} student records to {student_file}")

        # -------------------------------
        # Student Score
        # Rule: student info goes up to col M; scores start from N and continue
        # until the sentinel header 'P-Yr2' (exclusive).
        # -------------------------------
        start_scores_idx = col_letter_to_index('N')

        # Find sentinel column index (first column whose header equals 'P-Yr2'), else go to end
        sentinel_name = 'P-Yr2'
        end_scores_idx = len(df.columns) - 1
        for j in range(start_scores_idx, len(df.columns)):
            if str(df.columns[j]).strip() == sentinel_name:
                end_scores_idx = j - 1
                break

        # Filter to valid records, excluding the Excel row 2 header row (df.index == 1)
        filtered_df = df[valid_rows & ~(df.index == 1)].copy()

        # Matric_No comes from column M
        matric_nos = filtered_df.iloc[:, matric_col_index]
        cols = [pd.Series(matric_nos, name="Matric_No")]

        # Iterate columns in N..end_scores_idx, building course codes and attempts
        i = start_scores_idx
        while i <= end_scores_idx:
            raw_name = str(df.columns[i])
            if raw_name.startswith('Unnamed') or not raw_name.strip():
                i += 1
                continue

            clean_col_name = raw_name.strip()

            # Group follow-on unnamed columns as attempts for this course
            attempts = 1
            while i + attempts <= end_scores_idx and str(df.columns[i + attempts]).startswith('Unnamed'):
                attempts += 1

            # Only export course-code-like columns; skip arbitrary headers
            import re
            is_course_code = re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-_]{2,}", clean_col_name) is not None
            if not is_course_code:
                i += attempts
                continue

            if attempts == 1:
                s = filtered_df.iloc[:, i]
                s.name = clean_col_name  # single-attempt course
                cols.append(s)
            else:
                for attempt in range(attempts):
                    attempt_col = i + attempt
                    attempt_name = f"{clean_col_name}_Attempt{attempt+1}"
                    s = filtered_df.iloc[:, attempt_col]
                    s.name = attempt_name
                    cols.append(s)

            i += attempts

        score_df = pd.concat(cols, axis=1)

        # -------------------------------
        # Optional: Year 1 exemption logic retained
        # -------------------------------
        year_1_codes = get_year_1_course_codes()
        if year_1_codes:
            canon_codes = {c.strip().upper() for c in year_1_codes if isinstance(c, str)}

            def base_code(col_name: str) -> str:
                return col_name.split("_Attempt")[0].strip().upper()

            year1_attempt1_cols = [c for c in score_df.columns
                                   if c.endswith("_Attempt1") and base_code(c) in canon_codes]

            if year1_attempt1_cols:
                attempt1_numeric = score_df[year1_attempt1_cols].apply(pd.to_numeric, errors="coerce")
                all_attempt1_100_mask = (attempt1_numeric == 100).all(axis=1)
                score_df[year1_attempt1_cols] = score_df[year1_attempt1_cols].astype("object")
                mask_100s = (attempt1_numeric == 100) & all_attempt1_100_mask.to_numpy()[:, None]
                score_df[year1_attempt1_cols] = score_df[year1_attempt1_cols].where(~mask_100s, "Exempted")
                print(f"[DEBUG] Year 1 Attempt1 columns present: {sorted(year1_attempt1_cols)}")
                print(f"[DEBUG] rows all Year1 Attempt1 == 100: {int(all_attempt1_100_mask.sum())}")

        # -------------------------------
        # Fill '-' in all blank score cells (attempts and single-attempt columns)
        # -------------------------------
        def is_attempt_col(col: str) -> bool:
            return re.fullmatch(r".+_Attempt\d+", str(col)) is not None

        course_like = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_]{2,}$")
        attempt_cols = [c for c in score_df.columns if is_attempt_col(c)]
        single_cols = [c for c in score_df.columns
                       if c != "Matric_No" and c not in attempt_cols and course_like.fullmatch(str(c) or "")]

        target_cols = attempt_cols + single_cols
        if target_cols:
            score_df[target_cols] = score_df[target_cols].astype("object")
            empty_mask = score_df[target_cols].apply(lambda s: s.isna() | (s.astype(str).str.strip() == ""))
            for c in target_cols:
                score_df.loc[empty_mask[c], c] = "-"

        # -------------------------------
        # Save
        # -------------------------------
        score_file = os.path.join(output_folder, f"{sheet_name}_Student_Score.csv")
        score_df.to_csv(score_file, index=False, encoding='utf-8-sig')
        print(f"✅ Saved {len(score_df)} score records to {score_file}")
        print("\nScore file structure:")
        print(score_df.head(1).to_string(index=False))

        return [student_file, score_file]

    except Exception as e:
        print(f"\n❌ Error processing {sheet_name} sheet: {str(e)}")
        return None

def process_course_str(file_path, sheet_info, output_folder, is_legacy=False):
    """Process the Course-Str sheet and export course structure data."""
    print("\n[DEBUG] Starting process_course_str.")
    try:
        # Read Excel with first row as headers
        df = pd.read_excel(file_path, sheet_name=sheet_info['name'], header=0)
        
        # Convert column letters to indices
        def col_letter_to_index(col):
            index = 0
            for char in col.upper():
                index = index * 26 + (ord(char) - ord('A') + 1)
            return index - 1
        
        # Get column indices (including M for priority before filtering)
        code_idx = col_letter_to_index('A')
        classification_idx = col_letter_to_index('C')
        credit_hour_idx = col_letter_to_index('E')
        level_idx = col_letter_to_index('M')  # Column M index
        exclude_indices = [col_letter_to_index(col) for col in sheet_info.get('exclude_cols', [])]
        
        # Fix percentage values in K and L
        for col in ['K', 'L']:
            col_idx = col_letter_to_index(col)
            if col_idx < len(df.columns):
                df.iloc[:, col_idx] = df.iloc[:, col_idx].apply(
                    lambda x: x * 100 if pd.notna(x) and isinstance(x, (int, float)) and 0 <= x <= 1 else x
                )

        # Store original Level values before any filtering
        original_level_values = df.iloc[:, level_idx].copy()
        
        # Filter columns (A-N, exclude J)
        cols_to_keep = [i for i in range(col_letter_to_index('A'), col_letter_to_index('N')+1) 
                       if i not in exclude_indices]
        df = df.iloc[:, cols_to_keep]
        
        # Add Year classification
        current_year = None
        year_classification = []
        
        for idx, row in df.iterrows():
            # Use iloc for position-based access
            year_match = re.match(r'(Year\s*\d+|Compulsory)', str(row.iloc[0]), re.IGNORECASE)
            if year_match:
                current_year = year_match.group(0).title()
                year_classification.append(None)
                continue
            
            if (pd.notna(row.iloc[0]) and pd.notna(row.iloc[1]) and pd.notna(row.iloc[2])):
                year_classification.append(current_year)
            else:
                year_classification.append(None)
        
        # Add year column and filter valid rows
        df['Year'] = year_classification
        df = df[df['Year'].notna()].copy()

        # Add Course Status
        if not is_legacy:
            df['Course Status'] = df.apply(lambda row: 
                'Active' if (str(row.iloc[classification_idx]).strip().lower() != 'inactive' and 
                            pd.notna(row.iloc[credit_hour_idx]) and 
                            float(row.iloc[credit_hour_idx]) != 0)
                        else 'Inactive',
                axis=1)
        else:
            df['Course Status'] = 'Inactive'
        
        # Add Course Priority - using original Level values
        def get_priority(row):
            if row['Year'] == 'Compulsory':
                return 0
                #return 0 if str(row.iloc[code_idx]).startswith('MPU') else 999
            else:
                # Get the original Level value using the row's original index
                return original_level_values[row.name]  # row.name gives the original index
        
        df['Course Priority'] = df.apply(get_priority, axis=1)
        
        # Enhanced header cleaning
        def clean_header(header):
            header = str(header).replace('\n', ' ').replace('\r', ' ')
            return ' '.join(header.split()).strip()
        
        # Apply header cleaning
        df.columns = [clean_header(col) for col in df.columns]
        
        # Export to CSV
        output_file = os.path.join(output_folder, "Course_Structure.csv")
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"\n✅ Saved {len(df)} course records to {output_file}")
        print("\nSample output with new fields:")
        print(df[['Year', 'Course Status', 'Course Priority']].head())
        print("\nFirst complete course record:")
        print(df.head(1).to_string(index=False))
        
        print("[DEBUG] Finished process_course_str successfully.")
        return [output_file]
        
    except Exception as e:
        print(f"\n❌ Error processing Course-Str sheet: {str(e)}")
        print("[DEBUG] Finished process_course_str with an error.")
        return None

def clean_phone_number(phone):
    """Remove all non-digit characters from phone number"""
    if pd.isna(phone):
        return None
    
    # Convert to string and remove all non-digit characters
    digits = ''.join(c for c in str(phone) if c.isdigit())
    
    # Return None if empty, otherwise return cleaned digits
    return digits if digits else None

def resolve_course_code(conn, short_code: str) -> str | None:
    """
    Resolve a sheet short code like '120CT' to a canonical COURSE_CODE (e.g., 'INT120CT').
    Strategy:
      1) Exact (case-insensitive) match in COURSE_STRUCTURE.COURSE_CODE
      2) Startswith / endswith match
      3) Contains match
    Returns a single COURSE_CODE or None if ambiguous/not found.
    """
    sc = short_code.upper().strip()

    q_exact = "SELECT DISTINCT COURSE_CODE FROM COURSE_STRUCTURE WHERE UPPER(COURSE_CODE) = ?"
    q_sw = "SELECT DISTINCT COURSE_CODE FROM COURSE_STRUCTURE WHERE UPPER(COURSE_CODE) LIKE ?"
    with conn.cursor() as cur:
        # 1) exact
        cur.execute(q_exact, (sc,))
        rows = [r[0] for r in cur.fetchall()]
        if len(rows) == 1:
            return rows[0]

        # 2) startswith / endswith
        # startswith: INT120CT; endswith: 120CTXYZ
        candidates = set()
        cur.execute(q_sw, (sc + '%',))
        candidates.update(r[0] for r in cur.fetchall())
        cur.execute(q_sw, ('%' + sc,))
        candidates.update(r[0] for r in cur.fetchall())
        if len(candidates) == 1:
            return next(iter(candidates))
        if len(candidates) > 1:
            # Prefer ones that look like a prefix before the code (e.g., INT + code)
            pref = [c for c in candidates if c.upper().endswith(sc)]
            if len(pref) == 1:
                return pref[0]

        # 3) contains (broadest)
        cur.execute(q_sw, ('%' + sc + '%',))
        contains = [r[0] for r in cur.fetchall()]
        contains = list({c for c in contains})  # unique
        if len(contains) == 1:
            return contains[0]

        # Not found or ambiguous
        return None

def import_course_structure(csv_file_path, course_version):
    """
    Import course structure data from CSV to SQL Server
    
    Args:
        csv_file_path (str): Path to the CSV file
        course_version (str): The program code for this course structure.
                              (Note: Parameter name is legacy, but value is program code).
        
    Returns:
        tuple: (success_count, error_count) of records processed
    """
    print(f"\n[DEBUG] Starting import_course_structure.")
    print(f"[DEBUG]   CSV Path: {csv_file_path}")
    print(f"[DEBUG]   Program Code (from course_version param): {course_version}")

    conn = None
    insert_count = 0
    update_count = 0
    error_count = 0
    
    try:
        conn = get_db_connection()
        
        df = pd.read_csv(csv_file_path, header=0)
        print(f"[DEBUG]   Read {len(df)} rows from CSV.")

        if df.empty:
            print("[DEBUG]   CSV file is empty. Aborting import.")
            return 0, 0, 0
        
        update_query = """
        UPDATE COURSE_STRUCTURE SET
            MODULE = ?,
            COURSE_CLASSIFICATION = ?,
            PRE_CO_REQ = ?,
            CREDIT_HOUR = ?,
            LECT_HR_WK = ?,
            TUT_HR_WK = ?,
            LAB_HR_WK = ?,
            BL_HR_WK = ?,
            CU_CW_Credits = ?,
            CU_EX_Credits = ?,
            COURSE_LEVEL = ?,
            LECTURER = ?,
            COURSE_YEAR = ?,
            COURSE_STATUS = ?,
            COURSE_PRIORITY = ?,
            PROGRAM_CODE = ?
        WHERE COURSE_CODE = ?
        """
        
        insert_query = """
        INSERT INTO COURSE_STRUCTURE (
            COURSE_CODE, MODULE, COURSE_CLASSIFICATION, PRE_CO_REQ, 
            CREDIT_HOUR, LECT_HR_WK, TUT_HR_WK, LAB_HR_WK, 
            BL_HR_WK, CU_CW_Credits, CU_EX_Credits, 
            COURSE_LEVEL, LECTURER, COURSE_YEAR,
            COURSE_STATUS, COURSE_PRIORITY, PROGRAM_CODE
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        
        # Process each row
        with conn.cursor() as cursor:
            for idx, row in df.iterrows():
                print(f"[DEBUG]   Processing row {idx}...")
                try:
                    # Prepare values
                    values = [
                        str(row['Code']) if pd.notna(row['Code']) else None,
                        str(row['Module']) if pd.notna(row['Module']) else None,
                        str(row['Classification']) if pd.notna(row['Classification']) else None,
                        str(row['Pre/Co Req']) if pd.notna(row['Pre/Co Req']) else None,
                        int(row['Credit Hour']) if pd.notna(row['Credit Hour']) else None,
                        str(row['Lect hr/wk']) if pd.notna(row['Lect hr/wk']) else None,
                        str(row['Tut hr/wk']) if pd.notna(row['Tut hr/wk']) else None,
                        str(row['Lab hr/wk']) if pd.notna(row['Lab hr/wk']) else None,
                        str(row['BL hr/wk']) if pd.notna(row['BL hr/wk']) else None,
                        int(row['CU-CW Credits']) if pd.notna(row['CU-CW Credits']) else None,
                        int(row['CU-EX Credits']) if pd.notna(row['CU-EX Credits']) else None,
                        int(row['Level']) if pd.notna(row['Level']) else None,
                        str(row['Lecturer']) if pd.notna(row['Lecturer']) else None,
                        str(row['Year']) if pd.notna(row['Year']) else None,
                        str(row['Course Status']) if 'Course Status' in row and pd.notna(row['Course Status']) else None,
                        int(row['Course Priority']) if 'Course Priority' in row and pd.notna(row['Course Priority']) else None,
                        course_version
                    ]
                    
                    # First try to update
                    cursor.execute(update_query, values[1:] + [values[0]])
                    if cursor.rowcount > 0:
                        update_count += 1
                        print(f"[DEBUG]     Row {idx}: Updated existing record.")
                    else:
                        # If no rows were updated, try to insert
                        cursor.execute(insert_query, values)
                        insert_count += 1
                        print(f"[DEBUG]     Row {idx}: Inserted new record.")
                    
                except Exception as e:
                    error_count += 1
                    print(f"Error processing row {idx + 2}: {str(e)}")
                    print(f"Problematic values: {values}")
                    continue
            
            print("[DEBUG]   Committing transaction...")
            conn.commit()
            print(f"Import results:")
            print(f"- {insert_count} new records inserted")
            print(f"- {update_count} existing records updated")
            print(f"- {error_count} records had errors")
            
    except Exception as e:
        print(f"Import failed: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()
        print("[DEBUG] Finished import_course_structure.")
    
    return insert_count, update_count, error_count

def import_student_info(csv_file_path='Active_Student.csv'):
    """
    Import student data from CSV to SQL Server database.
    
    Args:
        csv_file_path (str): Path to the CSV file. Defaults to 'Active_Student.csv'.
    
    Returns:
        tuple: (success_count, error_count) of records processed
    """
    conn = None
    insert_count = 0
    update_count = 0
    error_count = 0
    
    # Determine student status based on filename
    filename = os.path.basename(csv_file_path).lower()
    if "active" in filename:
        student_status = "Active"
    elif "graduate" in filename:
        student_status = "Graduate"
    elif "withdraw" in filename:
        student_status = "Withdraw"
    else:
        raise ValueError(f"Unable to determine student status from filename: {csv_file_path}")
    
    try:
        conn = get_db_connection()
        
        # Read and prepare CSV data
        df = pd.read_csv(csv_file_path)
        
        # Clean and transform data
        df = df.rename(columns={
            'Name': 'STUDENT_NAME',
            'Cohort': 'COHORT',
            'Sem': 'SEM',
            'CU ID': 'CU_ID',
            'IC No': 'IC_NO',
            'Mobile No.': 'MOBILE_NO',
            'Email': 'EMAIL',
            'BM': 'BM',
            'English': 'ENGLISH',
            'Entry-Q': 'ENTRY_Q',
            'Matric No': 'MATRIC_NO',
            'Grad': 'GRADUATED_ON'
        })
        
        # Convert date format (handle errors)
        df['COHORT'] = pd.to_datetime(df['COHORT'], dayfirst=True, errors='coerce').dt.date
        # Convert CU_ID to proper integer format
        df['CU_ID'] = pd.to_numeric(df['CU_ID'], errors='coerce').astype('Int64')  # Uses pandas' nullable integer type
        # Clean phone numbers before import
        df['MOBILE_NO'] = df['MOBILE_NO'].apply(clean_phone_number)

        # Ensure GRADUATED_ON defaults to '-' if missing or blank
        if 'GRADUATED_ON' not in df.columns:
            df['GRADUATED_ON'] = '-'
        else:
            df['GRADUATED_ON'] = df['GRADUATED_ON'].apply(
                lambda x: str(x).strip() if pd.notna(x) and str(x).strip() != '' else '-'
            )

        update_query = """
        UPDATE STUDENTS SET
            STUDENT_NAME=?, COHORT=?, SEM=?, CU_ID=?, IC_NO=?, 
            MOBILE_NO=?, EMAIL=?, BM=?, ENGLISH=?, ENTRY_Q=?, STUDENT_STATUS=?, GRADUATED_ON=?
        WHERE MATRIC_NO=?
        """

        insert_query = """
        INSERT INTO STUDENTS (
            STUDENT_NAME, COHORT, SEM, CU_ID, IC_NO, 
            MOBILE_NO, EMAIL, BM, ENGLISH, ENTRY_Q, 
            MATRIC_NO, STUDENT_STATUS, GRADUATED_ON
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        # Process each row

        with conn.cursor() as cursor:
            for idx, row in df.iterrows():
                try:
                    values_common = [
                        row['STUDENT_NAME'],
                        row['COHORT'] if pd.notna(row['COHORT']) else None,
                        row['SEM'] if pd.notna(row['SEM']) else None,
                        str(row['CU_ID']) if pd.notna(row['CU_ID']) else None,
                        # str(row['IC_NO']) if pd.notna(row['IC_NO']) else None,
                        encrypt_ic(str(row['IC_NO'])) if pd.notna(row['IC_NO']) else None, # Encrypted IC No
                        str(row['MOBILE_NO']) if pd.notna(row['MOBILE_NO']) else None,
                        row['EMAIL'] if pd.notna(row['EMAIL']) else None,
                        row['BM'] if pd.notna(row['BM']) else None,
                        row['ENGLISH'] if pd.notna(row['ENGLISH']) else None,
                        row['ENTRY_Q'] if pd.notna(row['ENTRY_Q']) else None,
                    ]
                    matric_no = str(row['MATRIC_NO']) if pd.notna(row['MATRIC_NO']) else None
                    graduated_on = row['GRADUATED_ON']

                    # Check if record exists and get current values
                    cursor.execute("""
                        SELECT STUDENT_NAME, COHORT, SEM, CU_ID, IC_NO, MOBILE_NO, 
                            EMAIL, BM, ENGLISH, ENTRY_Q, STUDENT_STATUS, GRADUATED_ON
                        FROM STUDENTS 
                        WHERE MATRIC_NO = ?
                    """, (matric_no,))
                    
                    existing = cursor.fetchone()

                    if existing:
                        # Compare current values with new values
                        new_values = values_common + [student_status, graduated_on]
                        existing_values = list(existing)
                        
                        # Check if any value has changed (handle None comparisons)
                        has_changes = False
                        for old_val, new_val in zip(existing_values, new_values):
                            # Normalize None and empty string comparisons
                            old_normalized = str(old_val).strip() if old_val is not None else ""
                            new_normalized = str(new_val).strip() if new_val is not None else ""
                            if old_normalized != new_normalized:
                                has_changes = True
                                break
                        
                        if has_changes:
                            # Only update if there are actual changes
                            cursor.execute(update_query, values_common + [student_status, graduated_on, matric_no])
                            update_count += 1
                        # else: skip, no changes needed
                    else:
                        # Record doesn't exist, insert it
                        cursor.execute(insert_query, values_common + [matric_no, student_status, graduated_on])
                        insert_count += 1
                        
                except Exception as row_ex:
                    error_count += 1
                    logging.warning(f"Error processing row {idx + 2}: {str(row_ex)}")

            conn.commit()

    except Exception as e:
        logging.error(f"Import failed: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

    return insert_count, update_count, error_count

def import_student_scores(csv_file_path):
    conn = None
    insert_count = 0
    update_count = 0
    error_count = 0
    skip_count = 0

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT MATRIC_NO FROM STUDENTS")
        db_matrics = {row.MATRIC_NO for row in cursor.fetchall()}
        
        # Read CSV and find missing
        df = pd.read_csv(csv_file_path, skiprows=lambda x: x == 1)
        #df = pd.read_csv(csv_file_path)
        csv_matrics = set(df.iloc[:, 0].unique())
        #csv_matrics = set(df.iloc[:, 0].astype(str).str.strip().unique())
        missing_matrics = csv_matrics - db_matrics
        
        if missing_matrics:
            print("\n❌ Missing Matric Numbers Detected:")
            print("The following students need to be added to STUDENTS table first:")
            for matric in sorted(missing_matrics)[:20]:  # Show first 20
                print(f"- {matric}")
            
            # Create report
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S") # Use this for when updating scores using marksheet
            report_path = f"missing_matrics_{timestamp}.csv"
            pd.DataFrame(sorted(missing_matrics), columns=['MATRIC_NO']).to_csv(report_path, index=False)
            
            print(f"\n💾 Full list of {len(missing_matrics)} missing matrics saved to:")
            print(f"📄 {report_path}")
            
            return 0, 0, len(missing_matrics)  # Abort import

        # Read CSV with first column as matric_no
        df = pd.read_csv(csv_file_path, index_col=0, skiprows=lambda x: x == 1)
        #df = pd.read_csv(csv_file_path, index_col=0)
        
        # Initialize list to hold transformed data
        records = []
        
        # Process each student (row)
        for matric_no, row in df.iterrows():
            # Process each course (column)
            for col in df.columns:
                if pd.isna(row[col]) or row[col] == '':
                    continue
                    
                # Extract course code and attempt number
                if '_Attempt' in col:
                    course_code, attempt_str = col.split('_Attempt')
                    attempt_num = int(attempt_str)
                else:
                    course_code = col
                    attempt_num = 1  # Default to attempt 1
                
                # Find or create record for this student/course
                record = next(
                    (r for r in records 
                     if r['MATRIC_NO'] == matric_no and r['COURSE_CODE'] == course_code), 
                    None
                )
                
                if not record:
                    record = {
                        'MATRIC_NO': matric_no,
                        'COURSE_CODE': course_code,
                        'ATTEMPT_1': None,
                        'ATTEMPT_2': None,
                        'ATTEMPT_3': None
                    }
                    records.append(record)

                record[f'ATTEMPT_{attempt_num}'] = row[col]
                
                # Store the attempt
                if attempt_num == 1:
                    record['ATTEMPT_1'] = row[col]
                elif attempt_num == 2:
                    record['ATTEMPT_2'] = row[col]
                elif attempt_num == 3:
                    record['ATTEMPT_3'] = row[col]

        # Force MPU ATTEMPT_3 value to "N/A"
        for r in records:
            code = r.get('COURSE_CODE')
            if isinstance(code, str) and code.strip().upper().startswith('MPU'):
                r['ATTEMPT_3'] = 'N/A'

        update_query = """
        UPDATE STUDENT_SCORE SET
            ATTEMPT_1 = ?, ATTEMPT_2 = ?, ATTEMPT_3 = ?
        WHERE MATRIC_NO = ? AND COURSE_CODE = ?
        """

        insert_query = """
        INSERT INTO STUDENT_SCORE (
            MATRIC_NO, COURSE_CODE, ATTEMPT_1, ATTEMPT_2, ATTEMPT_3
        ) VALUES (?, ?, ?, ?, ?)
        """

        with conn.cursor() as cursor:
            for record in records:
                try:
                    # Check if record exists and get current values
                    cursor.execute("""
                        SELECT ATTEMPT_1, ATTEMPT_2, ATTEMPT_3
                        FROM STUDENT_SCORE 
                        WHERE MATRIC_NO = ? AND COURSE_CODE = ?
                    """, (record['MATRIC_NO'], record['COURSE_CODE']))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Compare current values with new values
                        new_values = [record['ATTEMPT_1'], record['ATTEMPT_2'], record['ATTEMPT_3']]
                        existing_values = list(existing)
                        
                        # Check if any value has changed
                        has_changes = False
                        for old_val, new_val in zip(existing_values, new_values):
                            # Normalize None and empty string comparisons
                            old_normalized = str(old_val).strip() if old_val is not None else ""
                            new_normalized = str(new_val).strip() if new_val is not None else ""
                            if old_normalized != new_normalized:
                                has_changes = True
                                break
                        
                        if has_changes:
                            # Only update if there are actual changes
                            cursor.execute(update_query,
                                record['ATTEMPT_1'],
                                record['ATTEMPT_2'],
                                record['ATTEMPT_3'],
                                record['MATRIC_NO'],
                                record['COURSE_CODE']
                            )
                            update_count += 1
                        else:
                            skip_count += 1
                    else:
                        # Record doesn't exist, insert it
                        cursor.execute(insert_query,
                            record['MATRIC_NO'],
                            record['COURSE_CODE'],
                            record['ATTEMPT_1'],
                            record['ATTEMPT_2'],
                            record['ATTEMPT_3']
                        )
                        insert_count += 1

                except Exception as e:
                    error_count += 1
                    logging.warning(f"Error on {record['MATRIC_NO']} {record['COURSE_CODE']}: {str(e)}")

            conn.commit()

        # Optional: log skip count
        if skip_count > 0:
            logging.info(f"Skipped {skip_count} records with no changes")

    except Exception as e:
        logging.error(f"Import failed: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

    return insert_count, update_count, error_count

def import_student_data(file_path, sheet_info, output_folder):
    """
    Wrapper: process Excel -> generate 2 CSVs (Student + Student_Score) -> import both into DB.
    Returns a dict summarizing the results.
    """
    output_files = process_student_datasheet(file_path, sheet_info, output_folder)
    if not output_files:
        return None

    # Identify which file is which, robustly
    student_csv = None
    score_csv = None
    for fpath in output_files:
        fname = os.path.basename(fpath).lower()
        if fname.endswith('_student.csv'):
            student_csv = fpath
        elif fname.endswith('_student_score.csv'):
            score_csv = fpath

    results = {
        "files": output_files,
        "students": {"inserted": 0, "updated": 0, "errors": 0},
        "scores": {"inserted": 0, "updated": 0, "errors": 0},
    }

    # Import into STUDENTS first (so scores can safely reference MATRIC_NO)
    if student_csv:
        student_inserts, student_updates, student_errors = import_student_info(student_csv)
        results["students"] = {"inserted": student_inserts, "updated": student_updates, "errors": student_errors}

    # Then import into STUDENT_SCORE
    if score_csv:
        score_inserts, score_updates, score_errors = import_student_scores(score_csv)
        results["scores"] = {"inserted": score_inserts, "updated": score_updates, "errors": score_errors}

    return results


def import_marksheet(xlsm_path: str, batch_size: int = 200):
    """
    Imports marks from an .xlsm file:
    - Processes sheets named '{COURSE_CODE} - BCSCU'
    - Valid row: col F (CU-ID) is int AND col K contains 'Mark copied'
    - Writes score from col J into STUDENT_SCORE for (MATRIC_NO, COURSE_CODE)
      following core vs MPU attempt rules.
    """
    conn = None
    cur = None
    updated = 0
    skipped = 0
    processed_sheets = 0

    # Generate timestamp for UPDATED_AT
    import_timestamp = datetime.now()

    # Mapping to prevent SQL injection
    ATTEMPT_UPDATES = {
        "ATTEMPT_1": """
            UPDATE dbo.STUDENT_SCORE
            SET ATTEMPT_1 = ?, LAST_UPDATED = ?
            WHERE MATRIC_NO = ? AND COURSE_CODE = ?
        """,
        "ATTEMPT_2": """
            UPDATE dbo.STUDENT_SCORE
            SET ATTEMPT_2 = ?, LAST_UPDATED = ?
            WHERE MATRIC_NO = ? AND COURSE_CODE = ?
        """,
        "ATTEMPT_3": """
            UPDATE dbo.STUDENT_SCORE
            SET ATTEMPT_3 = ?, LAST_UPDATED = ?
            WHERE MATRIC_NO = ? AND COURSE_CODE = ?
        """
    }

    try:
        # Discover sheet names then close handle immediately
        wb = pd.ExcelFile(xlsm_path, engine="openpyxl")
        try:
            sheet_names = list(wb.sheet_names)
        finally:
            try: wb.close()
            except Exception: pass

        matching = [sn for sn in sheet_names if COURSE_SHEET_RE.match(sn)]
        if not matching:
            logging.info("[INGEST] No matching sheets found in %s", xlsm_path)
            return {"updated": 0, "skipped": 0, "sheets": 0}

        # Connect
        conn = get_db_connection()
        cur = conn.cursor()
        logging.debug("Connected to DB for import_marksheet")

        # Precompiled queries
        # q_get_matric = """
        #   SELECT MATRIC_NO FROM STUDENTS WHERE TRY_CONVERT(INT, CU_ID) = ?
        # """
        q_get_matric = "SELECT MATRIC_NO FROM STUDENTS WHERE TRY_CONVERT(INT, CU_ID) = ?"
        q_get_row = """
          SELECT s.SCORE_ID, s.ATTEMPT_1, s.ATTEMPT_2, s.ATTEMPT_3,
                 s.A1_UPDATED_AT, s.A2_UPDATED_AT, s.A3_UPDATED_AT,
                 cs.COURSE_CLASSIFICATION
          FROM dbo.STUDENT_SCORE s
          LEFT JOIN dbo.COURSE_STRUCTURE cs ON cs.COURSE_CODE = s.COURSE_CODE
          WHERE s.MATRIC_NO = ? AND s.COURSE_CODE = ?
        """
        # q_update_attempt = lambda col: f"""
        #   UPDATE dbo.STUDENT_SCORE
        #      SET {col} = ?, LAST_UPDATED = ?
        #    WHERE MATRIC_NO = ? AND COURSE_CODE = ?
        # """

        # processed_sheets = 0

        for sheet_name in matching:
            m = COURSE_SHEET_RE.match(sheet_name)
            short_code = m.group(1).upper().strip()

            # 1) Resolve the sheet short code to the canonical DB COURSE_CODE once per sheet
            resolved_code = resolve_course_code(conn, short_code)
            if not resolved_code:
                logging.warning("[INGEST] Sheet %s: cannot resolve course code for '%s', skipping sheet",
                                sheet_name, short_code)
                # Count all rows in this sheet as skipped to keep tallies honest
                # We need the DF to know how many rows; load then skip.
                df_tmp = pd.read_excel(xlsm_path, sheet_name=sheet_name, engine="openpyxl", header=0)
                skipped += len(df_tmp)
                processed_sheets += 1
                logging.info("[INGEST] Sheet %s processed. cumulative updated=%d skipped=%d",
                             sheet_name, updated, skipped)
                continue

            # Load sheet data (after resolution)
            df = pd.read_excel(xlsm_path, sheet_name=sheet_name, engine="openpyxl", header=0)

            # Column positions by index (0-based): F=5, J=9, K=10
            col_f_idx = 5
            col_j_idx = 9
            col_k_idx = 10
            ncols = df.shape[1]
            if ncols <= max(col_f_idx, col_j_idx, col_k_idx):
                logging.warning("[INGEST] Sheet %s: not enough columns, skipping", sheet_name)
                skipped += len(df)
                processed_sheets += 1
                logging.info("[INGEST] Sheet %s processed. cumulative updated=%d skipped=%d",
                             sheet_name, updated, skipped)
                continue

            for _, row in df.iterrows():
                cu_raw = row.iloc[col_f_idx]
                note = str(row.iloc[col_k_idx]).strip().lower() if pd.notna(row.iloc[col_k_idx]) else ""
                score_raw = row.iloc[col_j_idx]

                # Validations
                try:
                    cu_id = int(str(cu_raw).strip())
                except Exception:
                    skipped += 1
                    continue
                if "mark copied" not in note:
                    skipped += 1
                    continue

                # Score normalization
                score_val = str(score_raw).strip() if pd.notna(score_raw) else "-"
                if score_val == "":
                    score_val = "-"

                # CU_ID -> MATRIC_NO
                cur.execute(q_get_matric, (cu_id,))
                r = cur.fetchone()
                if not r:
                    skipped += 1
                    continue
                matric_no = r[0]

                # 2) Use resolved_code for DB lookups/updates instead of the sheet short code
                cur.execute(q_get_row, (matric_no, resolved_code))
                rec = cur.fetchone()
                if not rec:
                    skipped += 1
                    continue

                (_score_id, a1, a2, a3, s1, s2, s3, cls) = rec
                cls = (cls or "").upper()

                def is_dash(v):
                    return (v is None) or (str(v).strip() == "-")

                # Decide target
                if cls == "MPU":
                    if is_dash(a1):
                        target = "ATTEMPT_1"
                    elif is_dash(a2):
                        target = "ATTEMPT_2"
                    else:
                        pair = [("ATTEMPT_1", s1), ("ATTEMPT_2", s2)]
                        pair.sort(key=lambda x: (x[1] is not None, x[1]))  # NULL oldest
                        target = pair[0][0]
                else:
                    if is_dash(a1):
                        target = "ATTEMPT_1"
                    elif is_dash(a2):
                        target = "ATTEMPT_2"
                    elif is_dash(a3):
                        target = "ATTEMPT_3"
                    else:
                        skipped += 1
                        continue

            # Validate target before using
            if target not in ATTEMPT_UPDATES:
                logging.error(f"Invalid target column: {target}")
                skipped += 1
                continue

            # Update with resolved_code using pre-defined query from dict
            cur.execute(ATTEMPT_UPDATES[target], (score_val, import_timestamp, matric_no, resolved_code))
            updated += 1
            if updated % batch_size == 0:
                conn.commit()

            processed_sheets += 1
            logging.info("[INGEST] Sheet %s processed. cumulative updated=%d skipped=%d",
                         sheet_name, updated, skipped)

        conn.commit()
        logging.info("[INGEST] Completed import_marksheet. updated=%d skipped=%d sheets=%d",
                     updated, skipped, processed_sheets)
        return {"updated": updated, "skipped": skipped, "sheets": processed_sheets}

    except Exception as e:
        logging.exception("import_marksheet failed: %s", str(e))
        if conn:
            conn.rollback()
        return {"updated": updated, "skipped": skipped, "error": str(e)}
    finally:
        try:
            if cur: cur.close()
        except Exception:
            pass
        try:
            if conn: conn.close()
        except Exception:
            pass