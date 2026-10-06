import { useState, useEffect } from 'react'; 
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import Login from './Components/Login';
import Signup from './Components/Signup';
import Brainrot from "./Components/Brainrot";
import Home from './Pages/Home';
import Session from './Components/Session';
import Nutrition from './Components/Nutrition';
import { getInitialTheme, applyTheme, changeTheme } from './Utils/theme';

function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <Router>
      <div className="App">
        <nav >
          <NavLink 
            to="/">
            Home
          </NavLink>
          <NavLink 
            to="/login" 

          >
            Login
          </NavLink>
          <NavLink 
            to="/signup" 
          >
            Signup
          </NavLink>
          <NavLink 
            to="/brainrot" 
          >
            Brainrot
          </NavLink>
          <NavLink
            to="/nutrition"
          >
            Nutrition
          </NavLink>
        </nav>

        <div>
          <Routes>
            <Route path="/" element={<Home theme={theme} setTheme={(next) => changeTheme(next, setTheme)} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/brainrot" element={<Brainrot />} />
            <Route path="/session" element={<Session />} />
            <Route path="/nutrition" element={<Nutrition />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;