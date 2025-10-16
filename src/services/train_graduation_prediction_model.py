# train_graduation_prediction_model.py
import os,sys

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

# Import your existing database connection from Flask app
from src.db.core import get_db_connection

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier
from sklearn.metrics import roc_auc_score, classification_report
import joblib, json, logging
from datetime import datetime

logging.basicConfig(filename='model_training.log', level=logging.INFO)

def extract_features_and_labels():
    """Query database to get features and labels for graduated students"""
    
    conn = get_db_connection()
    
    # query = """
    # WITH student_entry_year AS (
    #     SELECT 
    #         MATRIC_NO,
    #         CASE 
    #             WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
    #             THEN 2
    #             ELSE 1
    #         END AS entry_year_level,
    #         CASE 
    #             WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
    #             THEN 2
    #             ELSE 3
    #         END AS expected_years
    #     FROM STUDENT_SCORE
    #     GROUP BY MATRIC_NO
    # ),
    
    # student_features AS (
    #     SELECT 
    #         MATRIC_NO,
    #         COUNT(DISTINCT COURSE_CODE) as total_courses,
    #         SUM(CASE WHEN ATTEMPT_2 IS NOT NULL AND ATTEMPT_2 != '' THEN 1 ELSE 0 END) as resit_count_2,
    #         SUM(CASE WHEN ATTEMPT_3 IS NOT NULL AND ATTEMPT_3 != '' THEN 1 ELSE 0 END) as resit_count_3,
    #         SUM(CASE WHEN ATTEMPT_2 IS NOT NULL AND ATTEMPT_2 != '' THEN 1 ELSE 0 END) +
    #         SUM(CASE WHEN ATTEMPT_3 IS NOT NULL AND ATTEMPT_3 != '' THEN 1 ELSE 0 END) as total_resits,
    #         SUM(CASE WHEN ATTEMPT_1 LIKE 'R%%' THEN 1 ELSE 0 END) as deferred_courses,
    #         COUNT(CASE WHEN ATTEMPT_1 NOT IN ('Exempted', '-', '') THEN 1 END) as courses_with_scores
    #     FROM STUDENT_SCORE
    #     GROUP BY MATRIC_NO
    # ),
    
    # graduation_labels AS (
    #     SELECT 
    #         s.MATRIC_NO,
    #         s.COHORT,
    #         s.GRADUATED_ON,
    #         sey.entry_year_level,
    #         sey.expected_years,
            
    #         DATEPART(YEAR, s.COHORT) AS entry_year,
    #         DATEPART(MONTH, s.COHORT) AS entry_month,
            
    #         -- FIX: Convert 2-digit year to 4-digit year (24 -> 2024)
    #         2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) AS grad_year,
    #         CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) AS grad_month,
            
    #         DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) AS expected_grad_year,
    #         DATEPART(MONTH, s.COHORT) AS expected_grad_month,
            
    #         -- Now comparing 4-digit years (2024 vs 2024, not 24 vs 2024)
    #         CASE 
    #             WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) < DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) THEN 1
    #             WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) = DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) 
    #                  AND CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) <= DATEPART(MONTH, s.COHORT) THEN 1
    #             ELSE 0
    #         END AS on_time
            
    #     FROM STUDENTS s
    #     INNER JOIN student_entry_year sey ON s.MATRIC_NO = sey.MATRIC_NO
    #     WHERE 
    #         s.STUDENT_STATUS = 'Graduate'
    #         AND s.GRADUATED_ON != '-'
    #         AND s.GRADUATED_ON IS NOT NULL
    # )
    
    # SELECT 
    #     gl.*,
    #     sf.total_courses,
    #     sf.resit_count_2,
    #     sf.resit_count_3,
    #     sf.total_resits,
    #     sf.deferred_courses,
    #     sf.courses_with_scores,
    #     CAST(sf.total_resits AS FLOAT) / NULLIF(sf.total_courses, 0) as resit_ratio,
    #     CAST(sf.deferred_courses AS FLOAT) / NULLIF(sf.total_courses, 0) as deferral_ratio
    # FROM graduation_labels gl
    # INNER JOIN student_features sf ON gl.MATRIC_NO = sf.MATRIC_NO
    # ORDER BY gl.MATRIC_NO
    # """

    query = """
    WITH student_entry_year AS (
        SELECT 
            MATRIC_NO,
            CASE 
                WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
                THEN 2
                ELSE 1
            END AS entry_year_level,
            CASE 
                WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
                THEN 2
                ELSE 3
            END AS expected_years
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
    ),

    graduation_labels AS (
        SELECT 
            s.MATRIC_NO,
            s.COHORT,
            s.GRADUATED_ON,
            sey.entry_year_level,
            sey.expected_years,
            
            DATEPART(YEAR, s.COHORT) AS entry_year,
            DATEPART(MONTH, s.COHORT) AS entry_month,
            
            2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) AS grad_year,
            CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) AS grad_month,
            
            DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) AS expected_grad_year,
            DATEPART(MONTH, s.COHORT) AS expected_grad_month,
            
            CASE 
                WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) < DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) THEN 1
                WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) = DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) 
                     AND CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) <= DATEPART(MONTH, s.COHORT) THEN 1
                ELSE 0
            END AS on_time
            
        FROM STUDENTS s
        INNER JOIN student_entry_year sey ON s.MATRIC_NO = sey.MATRIC_NO
        WHERE 
            s.STUDENT_STATUS = 'Graduate'
            AND s.GRADUATED_ON != '-'
            AND s.GRADUATED_ON IS NOT NULL
    )

    SELECT 
        gl.*,
        
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
        
    FROM graduation_labels gl
    INNER JOIN student_features_enhanced sfe ON gl.MATRIC_NO = sfe.MATRIC_NO
    ORDER BY gl.MATRIC_NO
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    logging.info(f"Extracted {len(df)} training records from database")
    print(f"Extracted {len(df)} training records")
    return df

def train_model():
    """Train and save the graduation prediction model"""
    
    df = extract_features_and_labels()
    
    if len(df) == 0:
        print("ERROR: No training data found!")
        return None, 0
    
    print(f"\nTraining data shape: {df.shape}")
    print(f"On-time distribution:\n{df['on_time'].value_counts()}")
    
    on_time_count = df['on_time'].sum()
    late_count = len(df) - on_time_count
    
    if late_count == 0:
        print("\n⚠ WARNING: No late graduates found! Cannot train binary classifier.")
        print("Need students who graduated late (on_time = 0) to train the model.")
        return None, 0
    
    if late_count < 5 or on_time_count < 5:
        print(f"\n⚠ WARNING: Very limited data for one class!")
        print(f"On-time: {on_time_count}, Late: {late_count}")
        print("Training will proceed without probability calibration due to small sample size.")
        use_calibration = False
    else:
        use_calibration = True
    
    # UPDATED: Enhanced feature set with course-level details
    feature_cols = [
        # Basic
        'entry_year_level',
        'total_courses',
        'actual_courses_taken',
        
        # Attempt patterns (KEY PREDICTORS)
        'courses_passed_first_attempt',
        'courses_with_2_attempts',
        'courses_with_3_attempts',
        'total_courses_needing_resits',
        
        # Failure patterns (STRONG PREDICTORS)
        'total_first_attempt_failures',
        'courses_never_passed',
        'courses_passed_after_failing',
        
        # First attempt performance (VERY STRONG PREDICTORS)
        'avg_first_attempt_score',
        'lowest_first_attempt_score',
        'first_attempt_score_std_dev',
        
        # Final performance
        'avg_final_score',
        'lowest_final_score',
        
        # Success indicators
        'courses_with_distinction_first_attempt',
        'courses_barely_passed_first_attempt',
        'courses_capped_at_40',
        
        # Derived ratios (CRITICAL PREDICTORS)
        'first_attempt_pass_rate',
        'resit_rate',
        'first_attempt_failure_rate',
        'third_attempt_rate',
        'resit_success_rate'
    ]
    
    X = df[feature_cols].fillna(0)
    y = df['on_time']
    
    # For very small datasets, use all data for training (no test split)
    if len(df) < 20 or late_count < 5:
        print(f"\n⚠ Using all {len(df)} samples for training (no test set due to small sample size)")
        X_train, X_test = X, None
        y_train, y_test = y, None
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, stratify=y, random_state=42
        )
    
    pos = y_train.sum()
    neg = (y_train == 0).sum()
    scale_pos_weight = max(1.0, neg / max(1, pos))
    
    print(f"\nTraining samples: {len(X_train)}")
    if X_test is not None:
        print(f"Test samples: {len(X_test)}")
    print(f"Class balance - On-time: {pos}, Late: {neg}")
    print(f"Scale weight: {scale_pos_weight:.2f}")
    
    xgb = XGBClassifier(
        objective='binary:logistic',
        eval_metric='auc',
        tree_method='hist',
        random_state=42,
        n_estimators=200,
        learning_rate=0.1,
        max_depth=3,
        scale_pos_weight=scale_pos_weight,
        n_jobs=-1
    )
    
    print("\nTraining XGBoost model...")
    xgb.fit(X_train, y_train)
    
    # Only calibrate if we have enough data
    if use_calibration and neg >= 3 and pos >= 3:
        print("Calibrating probabilities...")
        try:
            cv_folds = 2 if min(neg, pos) < 5 else 3
            xgb_cal = CalibratedClassifierCV(xgb, method='sigmoid', cv=cv_folds)
            xgb_cal.fit(X_train, y_train)
            final_model = xgb_cal
            print(f"✓ Calibration successful (cv={cv_folds})")
        except Exception as e:
            print(f"⚠ Calibration failed: {e}")
            print("Using uncalibrated model instead.")
            final_model = xgb
    else:
        print("⚠ Skipping calibration due to insufficient data")
        final_model = xgb
    
    # Evaluate
    if X_test is not None and y_test is not None:
        y_pred_proba = final_model.predict_proba(X_test)[:, 1]
        y_pred = (y_pred_proba >= 0.5).astype(int)
        
        auc = roc_auc_score(y_test, y_pred_proba)
        
        print(f"\n{'='*60}")
        print(f"Model Performance (Test Set):")
        print(f"{'='*60}")
        print(f"AUC-ROC: {auc:.4f}")
        print(f"\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Late', 'On-time'], zero_division=0))
    else:
        y_pred_proba = final_model.predict_proba(X_train)[:, 1]
        y_pred = (y_pred_proba >= 0.5).astype(int)
        
        auc = roc_auc_score(y_train, y_pred_proba)
        
        print(f"\n{'='*60}")
        print(f"Model Performance (Training Set - no test set available):")
        print(f"{'='*60}")
        print(f"AUC-ROC: {auc:.4f} (Warning: May be optimistic)")
        print(f"\nClassification Report:")
        print(classification_report(y_train, y_pred, target_names=['Late', 'On-time'], zero_division=0))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': xgb.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print(f"\nTop 10 Most Important Features:")
    print(feature_importance.head(10).to_string(index=False))
    
    logging.info(f"Model trained - AUC: {auc:.4f}, Samples: {len(df)}, Late: {late_count}")
    
    # Create models directory if it doesn't exist
    os.makedirs('models', exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    model_path = f'models/graduation_model_{timestamp}.joblib'
    
    # Save models
    joblib.dump(final_model, model_path)
    joblib.dump(final_model, 'models/graduation_model_latest.joblib')
    joblib.dump(feature_cols, 'models/feature_columns.joblib')
    
    # Save metadata
    metadata = {
        'timestamp': timestamp,
        'total_samples': len(df),
        'on_time_count': int(on_time_count),
        'late_count': int(late_count),
        'auc': float(auc),
        'calibrated': use_calibration and neg >= 3 and pos >= 3,
        'features': feature_cols,
        'feature_count': len(feature_cols)
    }
    
    with open('models/model_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    # Save feature importance
    feature_importance.to_csv(f'models/feature_importance_{timestamp}.csv', index=False)
    
    logging.info(f"Model saved to {model_path}")
    print(f"\n✓ Model saved to {model_path}")
    print(f"✓ Latest model: models/graduation_model_latest.joblib")
    print(f"✓ Metadata: models/model_metadata.json")
    print(f"✓ Feature importance: models/feature_importance_{timestamp}.csv")
    
    return final_model, auc

if __name__ == "__main__":
    print("=" * 60)
    print("GRADUATION PREDICTION MODEL TRAINING")
    print("=" * 60)
    
    try:
        model, auc = train_model()
        if model:
            print("=" * 60)
            print(f"✓ TRAINING COMPLETE! Model AUC: {auc:.4f}")
            print("=" * 60)
            print("\nNOTE: Model trained with enhanced course-level features.")
            print("Performance will improve as more graduates are added to the system.")
        else:
            print("=" * 60)
            print("✗ TRAINING FAILED - Insufficient data")
            print("=" * 60)
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"ERROR during training: {e}")
        print(f"{'='*60}")
        logging.error(f"Training failed: {e}", exc_info=True)
        raise





















# # train_graduation_prediction_model.py
# import sys
# import os

# # Add project root to path
# project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
# sys.path.insert(0, project_root)

# # Import your existing database connection from Flask app
# from src.db.core import get_db_connection

# import pandas as pd
# from sklearn.model_selection import train_test_split
# from sklearn.calibration import CalibratedClassifierCV
# from xgboost import XGBClassifier
# from sklearn.metrics import roc_auc_score, classification_report
# import joblib
# from datetime import datetime
# import logging

# logging.basicConfig(filename='model_training.log', level=logging.INFO)

# def extract_features_and_labels():
#     """Query database to get features and labels for graduated students"""
    
#     conn = get_db_connection()
    
#     query = """
#     WITH student_entry_year AS (
#         SELECT 
#             MATRIC_NO,
#             CASE 
#                 WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
#                 THEN 2
#                 ELSE 1
#             END AS entry_year_level,
#             CASE 
#                 WHEN MAX(CASE WHEN ATTEMPT_1 = 'Exempted' THEN 1 ELSE 0 END) = 1 
#                 THEN 2
#                 ELSE 3
#             END AS expected_years
#         FROM STUDENT_SCORE
#         GROUP BY MATRIC_NO
#     ),
    
#     student_features AS (
#         SELECT 
#             MATRIC_NO,
#             COUNT(DISTINCT COURSE_CODE) as total_courses,
#             SUM(CASE WHEN ATTEMPT_2 IS NOT NULL AND ATTEMPT_2 != '' THEN 1 ELSE 0 END) as resit_count_2,
#             SUM(CASE WHEN ATTEMPT_3 IS NOT NULL AND ATTEMPT_3 != '' THEN 1 ELSE 0 END) as resit_count_3,
#             SUM(CASE WHEN ATTEMPT_2 IS NOT NULL AND ATTEMPT_2 != '' THEN 1 ELSE 0 END) +
#             SUM(CASE WHEN ATTEMPT_3 IS NOT NULL AND ATTEMPT_3 != '' THEN 1 ELSE 0 END) as total_resits,
#             SUM(CASE WHEN ATTEMPT_1 LIKE 'R%%' THEN 1 ELSE 0 END) as deferred_courses,
#             COUNT(CASE WHEN ATTEMPT_1 NOT IN ('Exempted', '-', '') THEN 1 END) as courses_with_scores
#         FROM STUDENT_SCORE
#         GROUP BY MATRIC_NO
#     ),
    
#     graduation_labels AS (
#         SELECT 
#             s.MATRIC_NO,
#             s.COHORT,
#             s.GRADUATED_ON,
#             sey.entry_year_level,
#             sey.expected_years,
            
#             DATEPART(YEAR, s.COHORT) AS entry_year,
#             DATEPART(MONTH, s.COHORT) AS entry_month,
            
#             -- FIX: Convert 2-digit year to 4-digit year (24 -> 2024)
#             2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) AS grad_year,
#             CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) AS grad_month,
            
#             DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) AS expected_grad_year,
#             DATEPART(MONTH, s.COHORT) AS expected_grad_month,
            
#             -- Now comparing 4-digit years (2024 vs 2024, not 24 vs 2024)
#             CASE 
#                 WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) < DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) THEN 1
#                 WHEN 2000 + CAST(SUBSTRING(s.GRADUATED_ON, 2, 2) AS INT) = DATEPART(YEAR, DATEADD(YEAR, sey.expected_years, s.COHORT)) 
#                      AND CAST(SUBSTRING(s.GRADUATED_ON, 5, 1) AS INT) <= DATEPART(MONTH, s.COHORT) THEN 1
#                 ELSE 0
#             END AS on_time
            
#         FROM STUDENTS s
#         INNER JOIN student_entry_year sey ON s.MATRIC_NO = sey.MATRIC_NO
#         WHERE 
#             s.STUDENT_STATUS = 'Graduate'
#             AND s.GRADUATED_ON != '-'
#             AND s.GRADUATED_ON IS NOT NULL
#     )
    
#     SELECT 
#         gl.*,
#         sf.total_courses,
#         sf.resit_count_2,
#         sf.resit_count_3,
#         sf.total_resits,
#         sf.deferred_courses,
#         sf.courses_with_scores,
#         CAST(sf.total_resits AS FLOAT) / NULLIF(sf.total_courses, 0) as resit_ratio,
#         CAST(sf.deferred_courses AS FLOAT) / NULLIF(sf.total_courses, 0) as deferral_ratio
#     FROM graduation_labels gl
#     INNER JOIN student_features sf ON gl.MATRIC_NO = sf.MATRIC_NO
#     ORDER BY gl.MATRIC_NO
#     """
    
#     df = pd.read_sql(query, conn)
#     conn.close()
    
#     logging.info(f"Extracted {len(df)} training records from database")
#     print(f"Extracted {len(df)} training records")
#     return df

# def train_model():
#     """Train and save the graduation prediction model"""
    
#     df = extract_features_and_labels()
    
#     if len(df) == 0:
#         print("ERROR: No training data found!")
#         return None, 0
    
#     print(f"\nTraining data shape: {df.shape}")
#     print(f"On-time distribution:\n{df['on_time'].value_counts()}")
    
#     # Check if we have both classes
#     on_time_count = df['on_time'].sum()
#     late_count = len(df) - on_time_count
    
#     if late_count == 0:
#         print("\n⚠ WARNING: No late graduates found! Cannot train binary classifier.")
#         print("Need students who graduated late (on_time = 0) to train the model.")
#         return None, 0
    
#     if late_count < 5 or on_time_count < 5:
#         print(f"\n⚠ WARNING: Class imbalance detected!")
#         print(f"On-time: {on_time_count}, Late: {late_count}")
#         print("Model may not be reliable with limited examples of one class.")
    
#     feature_cols = [
#         'entry_year_level', 'total_courses', 'resit_count_2', 'resit_count_3',
#         'total_resits', 'deferred_courses', 'resit_ratio', 'deferral_ratio'
#     ]
    
#     X = df[feature_cols].fillna(0)
#     y = df['on_time']
    
#     X_train, X_test, y_train, y_test = train_test_split(
#         X, y, test_size=0.2, stratify=y, random_state=42
#     )
    
#     pos = y_train.sum()
#     neg = (y_train == 0).sum()
#     scale_pos_weight = max(1.0, neg / max(1, pos))
    
#     print(f"\nTraining samples: {len(X_train)}, Test samples: {len(X_test)}")
#     print(f"Class balance - On-time: {pos}, Late: {neg}")
#     print(f"Scale weight: {scale_pos_weight:.2f}")
    
#     xgb = XGBClassifier(
#         objective='binary:logistic',
#         eval_metric='auc',
#         tree_method='hist',
#         random_state=42,
#         n_estimators=400,
#         learning_rate=0.05,
#         max_depth=4,
#         scale_pos_weight=scale_pos_weight,
#         n_jobs=-1
#     )
    
#     print("\nTraining XGBoost model...")
#     xgb.fit(X_train, y_train)
    
#     print("Calibrating probabilities...")
#     xgb_cal = CalibratedClassifierCV(xgb, method='isotonic', cv=3)
#     xgb_cal.fit(X_train, y_train)
    
#     # Evaluate on test set
#     y_pred_proba = xgb_cal.predict_proba(X_test)[:, 1]
#     y_pred = (y_pred_proba >= 0.5).astype(int)
    
#     auc = roc_auc_score(y_test, y_pred_proba)
    
#     print(f"\n{'='*60}")
#     print(f"Model Performance:")
#     print(f"{'='*60}")
#     print(f"AUC-ROC: {auc:.4f}")
#     print(f"\nClassification Report:")
#     print(classification_report(y_test, y_pred, target_names=['Late', 'On-time']))
    
#     # Feature importance
#     feature_importance = pd.DataFrame({
#         'feature': feature_cols,
#         'importance': xgb.feature_importances_
#     }).sort_values('importance', ascending=False)
    
#     print(f"\nTop Features:")
#     print(feature_importance.to_string(index=False))
    
#     logging.info(f"Model trained - AUC: {auc:.4f}")
    
#     # Create models directory if it doesn't exist
#     os.makedirs('models', exist_ok=True)
    
#     timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
#     model_path = f'models/graduation_model_{timestamp}.joblib'
    
#     # Save models
#     joblib.dump(xgb_cal, model_path)
#     joblib.dump(xgb_cal, 'models/graduation_model_latest.joblib')
#     joblib.dump(feature_cols, 'models/feature_columns.joblib')
    
#     # Save feature importance for reference
#     feature_importance.to_csv(f'models/feature_importance_{timestamp}.csv', index=False)
    
#     logging.info(f"Model saved to {model_path}")
#     print(f"\n✓ Model saved to {model_path}")
#     print(f"✓ Latest model: models/graduation_model_latest.joblib")
    
#     return xgb_cal, auc

# if __name__ == "__main__":
#     print("=" * 60)
#     print("GRADUATION PREDICTION MODEL TRAINING")
#     print("=" * 60)
    
#     try:
#         model, auc = train_model()
#         if model:
#             print("=" * 60)
#             print(f"✓ TRAINING COMPLETE! Model AUC: {auc:.4f}")
#             print("=" * 60)
#         else:
#             print("=" * 60)
#             print("✗ TRAINING FAILED - Insufficient data")
#             print("=" * 60)
#     except Exception as e:
#         print(f"\n{'='*60}")
#         print(f"ERROR during training: {e}")
#         print(f"{'='*60}")
#         logging.error(f"Training failed: {e}", exc_info=True)
#         raise
