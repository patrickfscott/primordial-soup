import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
