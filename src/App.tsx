import './App.css'
import AppRouter from './routes/AppRouter'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

function App() {
  const loadSessionFromStorage = useAuthStore((s) => s.loadSessionFromStorage);

  useEffect(() => {
    // sessionStorage tab close pe khud clear ho jaata hai
    // Refresh pe data rehta hai — toh sirf restore karo
    loadSessionFromStorage();
  }, []);

  return (
    <>
      <AppRouter />
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;