import React from "react";
import Login from "../components/auth/Login";
import { Link } from "react-router-dom";
import { useState } from "react";
import isEmail from "validator/lib/isEmail";
import "../App.css";

const LoginPage = () => {
  const handleFormSwitch = (formType) => {
    console.log(`Switching to ${formType} form`);
  };

  return (
    <div className="login-page-container">
      <Login onFormSwitch={handleFormSwitch}/>
    </div>
  );
};

export default LoginPage;