import React from "react";
import Home from "../components/Home"; // <- no curly braces here
import Sidebar from "../components/Sidebar";

const HomePage = () => {
  return (
    <div className="flex h-screen w-screen">
      <Sidebar />
      <div className="flex-1 p-8 w-full">
        <Home />
      </div>
    </div>
  );
};

export default HomePage;