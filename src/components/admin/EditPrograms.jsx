import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
    Box, Button, TextField, Typography, 
    IconButton, Dialog, DialogActions, DialogContent, DialogTitle, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Fab
} from '@mui/material';
import { Edit, Delete, Add } from '@mui/icons-material';

const EditPrograms = () => {
    const [programs, setPrograms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProgram, setCurrentProgram] = useState(null);
    const [newProgramCode, setNewProgramCode] = useState('');

    const fetchPrograms = async () => {
        try {
            const res = await api.get('/admin/programs');
            setPrograms(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                setError('Session expired. Please log in again.');
                // The interceptor in api.js should handle redirection
            } else {
                setError('Failed to fetch programs.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPrograms();
    }, []);

    const handleOpen = (program = null) => {
        if (program) {
            setIsEditing(true);
            setCurrentProgram(program);
            setNewProgramCode(program);
        } else {
            setIsEditing(false);
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentProgram(null);
        setNewProgramCode('');
        setIsEditing(false);
    };

    const handleSave = async () => {
        try {
            if (isEditing) {
                await api.put(`/admin/programs/${currentProgram}`,
                    { new_program_code: newProgramCode }
                );
            } else {
                await api.post('/admin/programs',
                    { program_code: newProgramCode }
                );
            }
            fetchPrograms();
            handleClose();
        } catch (err) {
            setError('Failed to save program.');
        }
    };

    const handleDelete = async (program) => {
        if (window.confirm(`Are you sure you want to delete the program "${program}"?`)) {
            try {
                await api.delete(`/admin/programs/${program}`);
                fetchPrograms();
            } catch (err) {
                setError('Failed to delete program.');
            }
        }
    };

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Programs - Manage different types of course codes available (e.g. BCSCUN)</Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                {isLoading ? (
                    <CircularProgress />
                ) : (
                    <TableContainer component={Paper} sx={{ border: '1px solid #eee', width: 'fit-content', maxHeight: 440 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ borderRight: '1px solid #eee', fontWeight: 'bold' }}>Program Code</TableCell>
                                    <TableCell align="center" sx={{ width: '150px', fontWeight: 'bold' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {programs.length > 0 ? programs.map((program, index) => (
                                    <TableRow key={index}>
                                        <TableCell component="th" scope="row" sx={{ borderRight: '1px solid #eee' }}>
                                            {program}
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton aria-label="edit" onClick={() => handleOpen(program)}>
                                                <Edit />
                                            </IconButton>
                                            <IconButton aria-label="delete" onClick={() => handleDelete(program)}>
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} align="center">
                                            No programs found. Please add one.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>{isEditing ? 'Edit Program' : 'Add New Program'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Program Code"
                        type="text"
                        fullWidth
                        variant="standard"
                        value={newProgramCode}
                        onChange={(e) => setNewProgramCode(e.target.value)}
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
                title="Add Program"
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

export default EditPrograms;
