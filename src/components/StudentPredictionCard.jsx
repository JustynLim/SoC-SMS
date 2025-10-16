// src/components/StudentPredictionCard.jsx
import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
  Chip,
  Grid,
  LinearProgress,
  Alert,
  AlertTitle,
} from '@mui/material';
import { Warning, CheckCircle, Info, InfoOutlined } from '@mui/icons-material';

const StudentPredictionCard = ({ matricNo, studentStatus }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matricNo) return;

    // Check if student is active before fetching prediction
    if (studentStatus && studentStatus !== 'Active') {
      setLoading(false);
      setPrediction(null);
      return;
    }

    fetch(`http://localhost:5001/api/predictions/student/${matricNo}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch prediction');
        return res.json();
      })
      .then((data) => {
        setPrediction(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [matricNo, studentStatus]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show message for non-active students
  if (studentStatus && studentStatus !== 'Active') {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Graduation Prediction
          </Typography>
          <Alert severity="info" icon={<InfoOutlined />} sx={{ mt: 2 }}>
            <AlertTitle>Analysis Not Available</AlertTitle>
            Graduation prediction analysis is only available for students with <strong>Active</strong> status.
            {studentStatus === 'Graduate' && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                This student has already graduated.
              </Typography>
            )}
            {studentStatus === 'Withdraw' && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                This student has withdrawn from the program.
              </Typography>
            )}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Graduation Prediction
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Error</AlertTitle>
            {error || 'Failed to load prediction'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'High Risk':
        return 'error';
      case 'Medium Risk':
        return 'warning';
      case 'Low Risk':
        return 'success';
      default:
        return 'default';
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'High Risk':
        return <Warning />;
      case 'Medium Risk':
        return <Info />;
      case 'Low Risk':
        return <CheckCircle />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Graduation Prediction
        </Typography>

        <Box mb={3}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="textSecondary">
              Prediction Status
            </Typography>
            <Chip
              label={prediction.prediction.prediction_label}
              color={prediction.prediction.will_graduate_on_time ? 'success' : 'error'}
              size="small"
            />
          </Box>

          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="textSecondary">
              Risk Level
            </Typography>
            <Chip
              icon={getRiskIcon(prediction.prediction.risk_level)}
              label={prediction.prediction.risk_level}
              color={getRiskColor(prediction.prediction.risk_level)}
              size="small"
            />
          </Box>

          <Box mt={2}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Probability of On-Time Graduation
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <LinearProgress
                variant="determinate"
                value={prediction.prediction.probability_on_time * 100}
                sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                color={
                  prediction.prediction.probability_on_time >= 0.7
                    ? 'success'
                    : prediction.prediction.probability_on_time >= 0.4
                    ? 'warning'
                    : 'error'
                }
              />
              <Typography variant="body2" fontWeight="bold">
                {(prediction.prediction.probability_on_time * 100).toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Academic Performance
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Total Courses
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {prediction.academic_progress.total_courses}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              First Attempt Pass
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {prediction.academic_progress.courses_passed_first_attempt}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Courses Needing Resits
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="error">
              {prediction.academic_progress.courses_needing_resits}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              Avg First Attempt Score
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {prediction.academic_progress.avg_first_attempt_score?.toFixed(1) || 'N/A'}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              First Attempt Pass Rate
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {(prediction.academic_progress.first_attempt_pass_rate * 100).toFixed(1)}%
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">
              First Attempt Failures
            </Typography>
            <Typography variant="body1" fontWeight="bold" color="error">
              {prediction.academic_progress.total_first_attempt_failures}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default StudentPredictionCard;
