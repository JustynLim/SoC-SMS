# src/services/graduation_prediction.py
import os
import joblib
import pandas as pd
import logging
from src.db.core import get_db_connection

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load model at module level (loaded once when imported)
MODEL_DIR = os.path.join(os.path.dirname(__file__), '../../models')
MODEL_PATH = os.path.join(MODEL_DIR, 'graduation_model_latest.joblib')
FEATURE_COLS_PATH = os.path.join(MODEL_DIR, 'feature_columns.joblib')

try:
    model = joblib.load(MODEL_PATH)
    feature_cols = joblib.load(FEATURE_COLS_PATH)
    logger.info("✓ Graduation prediction model loaded successfully")
    logger.info(f"✓ Using {len(feature_cols)} features for prediction")
except Exception as e:
    logger.warning(f"⚠ Could not load prediction model: {e}")
    model = None
    feature_cols = None


def extract_student_features(matric_no=None, student_status='Active'):
    """
    Extract features for students from database
    
    Args:
        matric_no: Optional. If provided, extract for single student.
        student_status: 'Active' (default) or 'Graduate' for testing
    
    Returns:
        DataFrame with student features
    """
    
    conn = get_db_connection()
    
    # Build WHERE clause
    where_clause = f"WHERE s.STUDENT_STATUS = '{student_status}'"
    if matric_no:
        where_clause += f" AND s.MATRIC_NO = '{matric_no}'"
    
    query = f"""
    WITH student_entry_year AS (
        SELECT 
            MATRIC_NO,
            CASE 
                WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
                THEN 2
                ELSE 1
            END AS entry_year_level
        FROM STUDENT_SCORE
        GROUP BY MATRIC_NO
    ),

    course_attempt_details AS (
        SELECT 
            MATRIC_NO,
            COURSE_CODE,
            ATTEMPT_1,
            ATTEMPT_2,
            ATTEMPT_3,
            
            CASE 
                WHEN ATTEMPT_1 NOT IN ('-', 'Exempted') 
                THEN 1 ELSE 0 
            END +
            CASE 
                WHEN ATTEMPT_2 != '-' 
                THEN 1 ELSE 0 
            END +
            CASE 
                WHEN ATTEMPT_3 NOT IN ('-', 'NULL')
                THEN 1 ELSE 0 
            END AS attempts_for_course,
            
            CASE 
                WHEN ATTEMPT_1 NOT IN ('Exempted', '-') 
                     AND ISNUMERIC(ATTEMPT_1) = 1 
                     AND CAST(ATTEMPT_1 AS FLOAT) < 40
                THEN 1 ELSE 0 
            END AS failed_first_attempt,
            
            CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END AS is_exempted,
            
            CASE 
                WHEN ATTEMPT_1 NOT IN ('Exempted', '-')
                     AND ISNUMERIC(ATTEMPT_1) = 1 
                THEN CAST(ATTEMPT_1 AS FLOAT)
                ELSE NULL
            END AS first_attempt_score,
            
            CASE 
                WHEN ATTEMPT_3 NOT IN ('-', 'NULL')
                     AND ISNUMERIC(ATTEMPT_3) = 1 
                THEN CAST(ATTEMPT_3 AS FLOAT)
                WHEN ATTEMPT_2 != '-'
                     AND ISNUMERIC(ATTEMPT_2) = 1 
                THEN CAST(ATTEMPT_2 AS FLOAT)
                WHEN ATTEMPT_1 NOT IN ('Exempted', '-')
                     AND ISNUMERIC(ATTEMPT_1) = 1 
                THEN CAST(ATTEMPT_1 AS FLOAT)
                ELSE NULL
            END AS final_score,
            
            CASE 
                WHEN (
                    (ATTEMPT_3 NOT IN ('-', 'NULL') AND ISNUMERIC(ATTEMPT_3) = 1 AND CAST(ATTEMPT_3 AS FLOAT) >= 40)
                    OR (ATTEMPT_2 != '-' AND ISNUMERIC(ATTEMPT_2) = 1 AND CAST(ATTEMPT_2 AS FLOAT) >= 40)
                    OR (ATTEMPT_1 NOT IN ('Exempted', '-') AND ISNUMERIC(ATTEMPT_1) = 1 AND CAST(ATTEMPT_1 AS FLOAT) >= 40)
                )
                THEN 1 ELSE 0 
            END AS eventually_passed
            
        FROM STUDENT_SCORE
    ),

    student_features_enhanced AS (
        SELECT 
            MATRIC_NO,
            COUNT(DISTINCT COURSE_CODE) as total_courses,
            SUM(is_exempted) as exempted_courses,
            COUNT(DISTINCT COURSE_CODE) - SUM(is_exempted) as actual_courses_taken,
            SUM(CASE WHEN attempts_for_course = 1 THEN 1 ELSE 0 END) as courses_passed_first_attempt,
            SUM(CASE WHEN attempts_for_course = 2 THEN 1 ELSE 0 END) as courses_with_2_attempts,
            SUM(CASE WHEN attempts_for_course = 3 THEN 1 ELSE 0 END) as courses_with_3_attempts,
            SUM(CASE WHEN attempts_for_course >= 2 THEN 1 ELSE 0 END) as total_courses_needing_resits,
            SUM(failed_first_attempt) as total_first_attempt_failures,
            SUM(CASE WHEN failed_first_attempt = 1 AND eventually_passed = 0 THEN 1 ELSE 0 END) as courses_never_passed,
            SUM(CASE WHEN failed_first_attempt = 1 AND eventually_passed = 1 THEN 1 ELSE 0 END) as courses_passed_after_failing,
            AVG(first_attempt_score) as avg_first_attempt_score,
            MIN(first_attempt_score) as lowest_first_attempt_score,
            STDEV(first_attempt_score) as first_attempt_score_std_dev,
            AVG(final_score) as avg_final_score,
            MIN(final_score) as lowest_final_score,
            MAX(final_score) as highest_final_score,
            SUM(CASE WHEN first_attempt_score >= 70 THEN 1 ELSE 0 END) as courses_with_distinction_first_attempt,
            SUM(CASE WHEN first_attempt_score >= 40 AND first_attempt_score < 50 THEN 1 ELSE 0 END) as courses_barely_passed_first_attempt,
            SUM(CASE WHEN final_score = 40 AND attempts_for_course > 1 THEN 1 ELSE 0 END) as courses_capped_at_40,
            SUM(CASE WHEN final_score < 40 THEN 1 ELSE 0 END) as courses_still_failing
        FROM course_attempt_details
        GROUP BY MATRIC_NO
    )

    SELECT 
        s.MATRIC_NO,
        s.STUDENT_NAME,
        s.COHORT,
        s.STUDENT_STATUS,
        sey.entry_year_level,
        sfe.total_courses,
        sfe.exempted_courses,
        sfe.actual_courses_taken,
        sfe.courses_passed_first_attempt,
        sfe.courses_with_2_attempts,
        sfe.courses_with_3_attempts,
        sfe.total_courses_needing_resits,
        sfe.total_first_attempt_failures,
        sfe.courses_never_passed,
        sfe.courses_passed_after_failing,
        sfe.avg_first_attempt_score,
        sfe.lowest_first_attempt_score,
        sfe.first_attempt_score_std_dev,
        sfe.avg_final_score,
        sfe.lowest_final_score,
        sfe.highest_final_score,
        sfe.courses_with_distinction_first_attempt,
        sfe.courses_barely_passed_first_attempt,
        sfe.courses_capped_at_40,
        sfe.courses_still_failing,
        CAST(sfe.courses_passed_first_attempt AS FLOAT) / NULLIF(sfe.actual_courses_taken, 0) as first_attempt_pass_rate,
        CAST(sfe.total_courses_needing_resits AS FLOAT) / NULLIF(sfe.actual_courses_taken, 0) as resit_rate,
        CAST(sfe.total_first_attempt_failures AS FLOAT) / NULLIF(sfe.actual_courses_taken, 0) as first_attempt_failure_rate,
        CAST(sfe.courses_with_3_attempts AS FLOAT) / NULLIF(sfe.total_courses_needing_resits, 0) as third_attempt_rate,
        CAST(sfe.courses_capped_at_40 AS FLOAT) / NULLIF(sfe.total_courses_needing_resits, 0) as resit_success_rate
    FROM STUDENTS s
    INNER JOIN student_entry_year sey ON s.MATRIC_NO = sey.MATRIC_NO
    INNER JOIN student_features_enhanced sfe ON s.MATRIC_NO = sfe.MATRIC_NO
    {where_clause}
    ORDER BY s.MATRIC_NO
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    return df


def predict_graduation(matric_no=None, student_status='Active'):
    """
    Predict on-time graduation for students
    
    Args:
        matric_no: Optional. If provided, predict for single student.
        student_status: 'Active' (default) for current students, 'Graduate' for testing
    
    Returns:
        DataFrame with predictions, or None if model not loaded
    """
    
    if model is None or feature_cols is None:
        logger.error("Model not loaded. Cannot make predictions.")
        return None
    
    # Extract features from database
    df = extract_student_features(matric_no, student_status)
    
    if df.empty:
        logger.warning(f"No {student_status} students found" + (f" with MATRIC_NO={matric_no}" if matric_no else ""))
        return None
    
    # Prepare features for prediction
    X = df[feature_cols].fillna(0)
    
    # Make predictions
    try:
        probabilities = model.predict_proba(X)[:, 1]  # Probability of on-time (class 1)
        predictions = (probabilities >= 0.5).astype(int)
        
        # Add predictions to dataframe
        df['prob_on_time'] = probabilities
        df['prob_late'] = 1 - probabilities
        df['prediction'] = predictions
        df['prediction_label'] = df['prediction'].map({1: 'On Time', 0: 'At Risk'})
        
        # Risk level categorization
        df['risk_level'] = pd.cut(
            df['prob_on_time'],
            bins=[0, 0.3, 0.7, 1.0],
            labels=['High Risk', 'Medium Risk', 'Low Risk']
        )
        
        logger.info(f"Predicted for {len(df)} students")
        
        return df
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return None


def get_at_risk_students(threshold=0.5):
    """
    Get list of active students at risk of not graduating on time
    
    Args:
        threshold: Probability threshold (students below this are at risk)
    
    Returns:
        DataFrame of at-risk students, sorted by risk level
    """
    
    predictions = predict_graduation(student_status='Active')
    
    if predictions is None:
        return None
    
    # Filter students at risk
    at_risk = predictions[predictions['prob_on_time'] < threshold].copy()
    at_risk = at_risk.sort_values('prob_on_time', ascending=True)
    
    return at_risk[[
        'MATRIC_NO', 'STUDENT_NAME', 'COHORT', 'entry_year_level',
        'total_courses', 'total_courses_needing_resits', 'total_first_attempt_failures',
        'avg_first_attempt_score', 'prob_on_time', 'prob_late', 'risk_level'
    ]]
