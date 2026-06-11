import React from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { AppLayout } from './components/layout/AppLayout';
import { StickyNote } from './components/tasks/StickyNote';

const App: React.FC = () => {
  const isSticky = window.location.hash === '#/sticky';

  if (isSticky) {
    return (
      <ThemeProvider>
        <StickyNote />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  );
};

export default App;
