import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    Box, Button, TextField, Typography, 
    IconButton, Dialog, DialogActions, DialogContent, DialogTitle, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Fab
} from '@mui/material';
import { Edit, Archive, Add } from '@mui/icons-material';

const EditLecturers = () => {
    const [lecturers, setLecturers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentLecturer, setCurrentLecturer] = useState(null);
    const [newLecturerName, setNewLecturerName] = useState('');

    const fetchLecturers = async () => {
        try {
            const res = await api.get('/admin/lecturers');
            setLecturers(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                setError('Session expired. Please log in again.');
            } else {
                setError('Failed to fetch lecturers.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLecturers();
    }, []);

    const handleOpen = (lecturer = null) => {
        if (lecturer) {
            setIsEditing(true);
            setCurrentLecturer(lecturer);
            setNewLecturerName(lecturer);
        } else {
            setIsEditing(false);
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentLecturer(null);
        setNewLecturerName('');
        setIsEditing(false);
    };

    const handleSave = async () => {
        try {
            if (isEditing) {
                await api.put(`/admin/lecturers/${currentLecturer}`,
                    { new_lecturer_name: newLecturerName }
                );
            } else {
                await api.post('/admin/lecturers',
                    { lecturer_name: newLecturerName }
                );
            }
            fetchLecturers();
            handleClose();
        } catch (err) {
            setError('Failed to save lecturer.');
        }
    };

    const handleDelete = async (lecturer) => {
        if (window.confirm(`Are you sure you want to deactivate the lecturer "${lecturer}"? This will remove them from the list of available lecturers for new courses, but will not affect existing records.`)) {
            try {
                await api.delete(`/admin/lecturers/${lecturer}`);
                fetchLecturers();
            } catch (err) {
                setError('Failed to deactivate lecturer.');
            }
        }
    };

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Lecturers - Manage lecturers available</Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                {isLoading ? (
                    <CircularProgress />
                ) : (
                    <TableContainer component={Paper} sx={{ border: '1px solid #eee', width: 'fit-content', maxHeight: 440 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ borderRight: '1px solid #eee', fontWeight: 'bold' }}>Lecturer</TableCell>
                                    <TableCell align="center" sx={{ width: '150px', fontWeight: 'bold' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {lecturers.length > 0 ? lecturers.map((lecturer, index) => (
                                    <TableRow key={index}>
                                        <TableCell component="th" scope="row" sx={{ borderRight: '1px solid #eee' }}>
                                            {lecturer}
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton aria-label="edit" onClick={() => handleOpen(lecturer)}>
                                                <Edit />
                                            </IconButton>
                                            <IconButton aria-label="delete" onClick={() => handleDelete(lecturer)}>
                                                <Archive />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} align="center">
                                            No lecturers found. Please add one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{isEditing ? 'Edit Lecturer' : 'Add New Lecturer'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Lecturer Name"
                        type="text"
                        fullWidth
                        variant="standard"
                        value={newLecturerName}
                        onChange={(e) => setNewLecturerName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </DialogActions>
            </Dialog>

            <Fab
                color="primary"
                aria-label="add"
                title="AddLecturer"
                sx={{
                    position: 'fixed',
                    bottom: 40,
                    right: 40,
                }}
                onClick={() => handleOpen()}
            >
                <Add />
            </Fab>
        </Box>
    );
};

export default EditLecturers;
