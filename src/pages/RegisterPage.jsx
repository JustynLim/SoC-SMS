import Register from '../components/auth/Register';
import "../App.css";

const RegistrationPage = () => {
  const handleFormSwitch = (formType) => {
    console.log(`Switching to ${formType} form`);
  };

  return (
    <div className="register-page-container">
      <Register onFormSwitch={handleFormSwitch}/>
    </div>
  );
};

export default RegistrationPage;