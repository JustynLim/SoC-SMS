import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, Button, TextField, Typography, 
    IconButton, Dialog, DialogActions, DialogContent, DialogTitle, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Fab
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';

const EditStudentStatus = () => {
    const [statuses, setStatuses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(null);
    const [newStatusName, setNewStatusName] = useState('');

    const fetchStatuses = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('http://localhost:5001/api/admin/student-statuses', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatuses(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                setError('Session expired. Please log in again.');
                localStorage.removeItem('token');
                window.location.href = '/login';
            } else {
                setError('Failed to fetch statuses.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatuses();
    }, []);

    const handleOpen = (status = null) => {
        if (status) {
            setIsEditing(true);
            setCurrentStatus(status);
            setNewStatusName(status);
        } else {
            setIsEditing(false);
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentStatus(null);
        setNewStatusName('');
        setIsEditing(false);
    };

    const handleSave = async () => {
        try {
            const token = localStorage.getItem('token');
            if (isEditing) {
                await axios.put(`http://localhost:5001/api/admin/student-statuses/${currentStatus}`,
                    { new_status_name: newStatusName },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            } else {
                await axios.post('http://localhost:5001/api/admin/student-statuses',
                    { status_name: newStatusName },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            fetchStatuses();
            handleClose();
        } catch (err) {
            setError('Failed to save status.');
        }
    };

    const handleDelete = async (statusName) => {
        if (window.confirm('Are you sure you want to delete this status?')) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`http://localhost:5001/api/admin/student-statuses/${statusName}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                fetchStatuses();
            } catch (err) {
                setError('Failed to delete status.');
            }
        }
    };

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Status - Used to classify students, typically: Active, Graduate, Withdraw</Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                {isLoading ? (
                    <CircularProgress />
                ) : (
                    <TableContainer component={Paper} sx={{ border: '1px solid #eee', width: 'fit-content' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ borderRight: '1px solid #eee', fontWeight: 'bold' }}>Status Name</TableCell>
                                    <TableCell align="center" sx={{ width: '150px', fontWeight: 'bold' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {statuses.length > 0 ? statuses.map((status, index) => (
                                    <TableRow key={index}>
                                        <TableCell component="th" scope="row" sx={{ borderRight: '1px solid #eee' }}>
                                            {status}
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton aria-label="edit" onClick={() => handleOpen(status)}>
                                                <Edit />
                                            </IconButton>
                                            <IconButton aria-label="delete" onClick={() => handleDelete(status)}>
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} align="center">
                                            No student statuses found. Please add one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{isEditing ? 'Edit Status' : 'Add New Status'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Status Name"
                        type="text"
                        fullWidth
                        variant="standard"
                        value={newStatusName}
                        onChange={(e) => setNewStatusName(e.target.value)}
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

export default EditStudentStatus;