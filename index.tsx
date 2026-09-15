
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handler for debugging initialization crashes
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error caught:", message, "at", source, ":", lineno, ":", colno);
  const loader = document.getElementById('fallback-loader');
  if (loader) {
    const errorMsg = document.createElement('div');
    errorMsg.style.color = '#ef4444';
    errorMsg.style.fontSize = '10px';
    errorMsg.style.marginTop = '10px';
    errorMsg.style.textAlign = 'center';
    errorMsg.innerText = "Error: " + message;
    loader.appendChild(errorMsg);
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
