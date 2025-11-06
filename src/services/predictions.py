# Flask API endpoint to expose prediction function
from flask import Blueprint, jsonify, request
import pandas as pd
from src.services.graduation_prediction import predict_graduation, get_at_risk_students

# Create blueprint
prediction_bp = Blueprint('predictions', __name__, url_prefix='/api/predictions')

# Individual students (for details page
@prediction_bp.route('/student/<matric_no>', methods=['GET'])
def predict_single_student(matric_no):
    """Predict graduation for a single student"""
    
    result = predict_graduation(matric_no=matric_no, student_status='Active')
    
    if result is None or result.empty:
        return jsonify({'error': 'Student not found or model not available'}), 404
    
    student = result.iloc[0]
    
    response = {
        'matric_no': student['MATRIC_NO'],
        'name': student['STUDENT_NAME'],
        'cohort': str(student['COHORT']),
        'entry_year_level': int(student['entry_year_level']),
        'academic_progress': {
            'total_courses': int(student['total_courses']),
            'courses_passed_first_attempt': int(student['courses_passed_first_attempt']),
            'courses_needing_resits': int(student['courses_still_failing']),
            'courses_with_2_attempts': int(student['courses_with_2_attempts']),
            'courses_with_3_attempts': int(student['courses_with_3_attempts']),
            'total_first_attempt_failures': int(student['total_first_attempt_failures']),
            'avg_first_attempt_score': round(float(student['avg_first_attempt_score']), 2) if pd.notna(student['avg_first_attempt_score']) else None,
            'avg_final_score': round(float(student['avg_final_score']), 2) if pd.notna(student['avg_final_score']) else None,
            'first_attempt_pass_rate': round(float(student['first_attempt_pass_rate']), 3) if pd.notna(student['first_attempt_pass_rate']) else 0,
            'resit_rate': round(float(student['resit_rate']), 3) if pd.notna(student['resit_rate']) else 0,
        },
        'prediction': {
            'will_graduate_on_time': bool(student['prediction']),
            'prediction_label': student['prediction_label'],
            'probability_on_time': round(float(student['prob_on_time']), 3),
            'probability_late': round(float(student['prob_late']), 3),
            'risk_level': student['risk_level']
        }
    }
    
    return jsonify(response), 200

# All students (for dashboard)
@prediction_bp.route('/all-students', methods=['GET'])
def predict_all_students():
    """Predict graduation for all active students"""
    
    results = predict_graduation(student_status='Active')
    
    if results is None:
        return jsonify({'error': 'Model not available'}), 500
    
    if results.empty:
        return jsonify({'message': 'No active students found', 'predictions': []}), 200
    
    predictions = []
    for _, student in results.iterrows():
        predictions.append({
            'matric_no': student['MATRIC_NO'],
            'name': student['STUDENT_NAME'],
            'cohort': str(student['COHORT']),
            'entry_year_level': int(student['entry_year_level']),
            'prediction_label': student['prediction_label'],
            'probability_on_time': round(float(student['prob_on_time']), 3),
            'risk_level': student['risk_level'],
            'total_resits': int(student['courses_still_failing']),
            'first_attempt_failures': int(student['total_first_attempt_failures']),
            'avg_first_attempt_score': round(float(student['avg_first_attempt_score']), 2) if pd.notna(student['avg_first_attempt_score']) else None
        })
    
    # Summary statistics
    summary = {
        'total_students': len(predictions),
        'on_time_predicted': int(results['prediction'].sum()),
        'at_risk_predicted': int((results['prediction'] == 0).sum()),
        'high_risk_count': int((results['risk_level'] == 'High Risk').sum()),
        'medium_risk_count': int((results['risk_level'] == 'Medium Risk').sum()),
        'low_risk_count': int((results['risk_level'] == 'Low Risk').sum()),
    }
    
    return jsonify({
        'summary': summary,
        'predictions': predictions
    }), 200


@prediction_bp.route('/at-risk', methods=['GET'])
def get_at_risk():
    """Get students at risk of not graduating on time"""
    
    threshold = float(request.args.get('threshold', 0.5))
    
    at_risk = get_at_risk_students(threshold=threshold)
    
    if at_risk is None:
        return jsonify({'error': 'Model not available'}), 500
    
    if at_risk.empty:
        return jsonify({
            'message': 'No at-risk students found',
            'threshold': threshold,
            'students': []
        }), 200
    
    students = []
    for _, student in at_risk.iterrows():
        students.append({
            'matric_no': student['MATRIC_NO'],
            'name': student['STUDENT_NAME'],
            'cohort': str(student['COHORT']),
            'entry_year_level': int(student['entry_year_level']),
            'total_courses': int(student['total_courses']),
            'total_resits': int(student['courses_still_failing']),
            'first_attempt_failures': int(student['total_first_attempt_failures']),
            'avg_first_attempt_score': round(float(student['avg_first_attempt_score']), 2) if pd.notna(student['avg_first_attempt_score']) else None,
            'probability_on_time': round(float(student['prob_on_time']), 3),
            'probability_late': round(float(student['prob_late']), 3),
            'risk_level': student['risk_level']
        })
    
    return jsonify({
        'total_at_risk': len(students),
        'threshold': threshold,
        'students': students
    }), 200


@prediction_bp.route('/statistics', methods=['GET'])
def get_prediction_statistics():
    """Get overall prediction statistics for all active students"""
    
    results = predict_graduation(student_status='Active')
    
    if results is None or results.empty:
        return jsonify({'error': 'No data available'}), 500
    
    stats = {
        'total_students': len(results),
        'predictions': {
            'on_time': int(results['prediction'].sum()),
            'at_risk': int((results['prediction'] == 0).sum())
        },
        'risk_levels': {
            'high_risk': int((results['risk_level'] == 'High Risk').sum()),
            'medium_risk': int((results['risk_level'] == 'Medium Risk').sum()),
            'low_risk': int((results['risk_level'] == 'Low Risk').sum())
        },
        'academic_metrics': {
            'avg_first_attempt_score': round(float(results['avg_first_attempt_score'].mean()), 2),
            'avg_first_attempt_pass_rate': round(float(results['first_attempt_pass_rate'].mean()), 3),
            'avg_resit_rate': round(float(results['resit_rate'].mean()), 3),
            'students_with_resits': int((results['total_courses_needing_resits'] > 0).sum())
        },
        'probability_distribution': {
            'very_high_prob': int((results['prob_on_time'] >= 0.8).sum()),
            'high_prob': int((results['prob_on_time'] >= 0.6) & (results['prob_on_time'] < 0.8)).sum(),
            'medium_prob': int((results['prob_on_time'] >= 0.4) & (results['prob_on_time'] < 0.6)).sum(),
            'low_prob': int((results['prob_on_time'] < 0.4).sum())
        }
    }
    
    return jsonify(stats), 200
