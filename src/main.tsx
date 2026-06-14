import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Add platform class so CSS can adjust for macOS traffic lights
if (navigator.userAgent.includes('Macintosh')) {
  document.documentElement.classList.add('mac');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
