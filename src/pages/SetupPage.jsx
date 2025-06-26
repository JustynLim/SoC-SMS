import { Setup } from '../components/auth/Setup';
import {SetupGuard} from '../components/SetupGuard'
import "../App.css";

// const SetupPage = () => {
//   const handleFormSwitch = (formType) => {
//     console.log(`Switching to ${formType} form`);
//   };

//   return(
//     <div className="register-page-container">
//         <SetupGuard>
//         <Setup onFormSwitch={handleFormSwitch}/>
//         </SetupGuard>
//         </div>
//   );
// };

// export default SetupPage

const SetupPage = () => {
  return (
    <>
      <SetupGuard>
        <Setup />
      </SetupGuard>
    </>
  );
};

export default SetupPage