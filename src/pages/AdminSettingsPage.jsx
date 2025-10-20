import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import Sidebar from '../components/Sidebar'; // Import Sidebar
import EditStudentStatus from '../components/admin/EditStudentStatus';
import EditPrograms from '../components/admin/EditPrograms';


function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AdminSettingsPage = () => {
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <div className="flex-1 p-8 w-full">
        <Box sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={value} onChange={handleChange} aria-label="admin settings tabs">
              <Tab label="Edit Student Status" id="admin-tab-0" />
              <Tab label="Edit Programs" id="admin-tab-1" />
            </Tabs>
          </Box>
          <TabPanel value={value} index={0}>
            <EditStudentStatus />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <EditPrograms />
          </TabPanel>        </Box>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
