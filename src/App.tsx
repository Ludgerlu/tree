import React from 'react';
import { AppProvider } from './context/AppContext';
import TreePage from './pages/TreePage';
import './styles/app.css';
import './App.css';

function App() {
  return (
    <AppProvider>
      <TreePage />
    </AppProvider>
  );
}

export default App;
