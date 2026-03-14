import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import favicon from './assets/favicon.svg';

const faviconLink = document.createElement('link');
faviconLink.rel = 'icon';
faviconLink.href = favicon;
faviconLink.type = 'image/svg+xml';

document.head.appendChild(faviconLink);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
