import React, { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import GenerateList from "../components/GenerateList";
import { Typography, Box } from "@mui/material";

export default function GenerateListPage() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="flex h-screen w-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col p-8 w-full overflow-hidden">
        <Typography variant="h4" component="h1" gutterBottom>
          Generate Internship/Mentorship list
        </Typography>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <GenerateList />
        </Box>
      </div>
    </div>
  );
}
