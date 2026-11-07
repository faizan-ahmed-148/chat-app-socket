import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'

import 'react-perfect-scrollbar/dist/css/styles.css';
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx';
import { Toaster } from 'react-hot-toast';
createRoot(document.getElementById('root')).render(
        <AuthProvider>
    <Toaster />

    <App />
    </AuthProvider>
)
