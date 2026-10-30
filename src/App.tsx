import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from 'next-themes';
import Index from './pages/Index';

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <Toaster />
    <Index />
  </ThemeProvider>
);

export default App;
