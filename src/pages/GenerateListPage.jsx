import React from "react";
import Sidebar from "../components/Sidebar";
import GenerateList from "../components/GenerateList";
import "../App.css";

export default function GenerateListPage() {
  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <div className="flex-1 p-8 w-full overflow-auto">
        <h2 style={{ marginTop: 0 }}>Generate List</h2>
        <GenerateList />
      </div>
    </div>
  );
}
