import React from "react";
import Import from "../components/Import";
import Sidebar from "../components/Sidebar";

const ImportPage = () => {
  return (
    <div className="flex h-screen w-screen"> {/* <-- Add h-screen here */}
      <Sidebar />
      <div className="flex-1 p-8 w-full">
        <h1 className="text-3xl font-bold mb-4">Excel Import Page</h1>
        <Import />
      </div>
    </div>
  );
};

export default ImportPage;