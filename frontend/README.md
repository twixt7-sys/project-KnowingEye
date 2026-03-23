# Knowing Eye - Frontend Prototype

A full-stack session-guided web-based examination platform with integrated behavior monitoring system using facial and postural analysis via computer vision.

## Current Status

This is a **frontend prototype** implementing the user interface and user experience for the Knowing Eye examination platform. The backend, database, and AI monitoring features are planned but not yet implemented.

### ✅ Implemented Features
- Modern React/TypeScript frontend with Vite
- Responsive UI using shadcn/ui and Material-UI components
- Complete exam flow simulation (taking, submission, results)
- Mock behavior monitoring with simulated alerts
- Multiple user roles (admin dashboard, student dashboard)
- Dark/light theme support

### ❌ Planned Features (Backend Required)
- Real-time webcam capture and frame streaming
- AI-powered facial and posture analysis
- User authentication and session management
- Database persistence for exams and results
- WebSocket communication for live monitoring
- Administrative exam management interface

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui + Material-UI
- **Routing**: React Router v6
- **Icons**: Lucide React
- **State Management**: React hooks
- **Package Manager**: npm

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd my-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── app/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── routes.ts      # Application routing
│   ├── root.tsx       # Root layout
│   └── App.tsx        # Main app component
├── styles/            # CSS files and themes
└── main.tsx           # Application entry point
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Key Pages

- `/` - Landing page
- `/features` - System features showcase
- `/login` - Authentication page
- `/dashboard` - Admin dashboard
- `/student/dashboard` - Student exam access
- `/student/exam/:id` - Exam taking interface
- `/student/exam/:id/submitted` - Post-submission page
- `/student/exam/:id/results` - Results display

## Mock Features

The current implementation includes simulated features for demonstration:
- Random behavior monitoring alerts
- Mock exam questions and answers
- Simulated timer functionality
- Placeholder user authentication

## Next Steps

1. **Backend Development**: Implement Django REST API
2. **Database Integration**: Set up PostgreSQL with full schema
3. **Real Monitoring**: Integrate computer vision for actual webcam analysis
4. **Authentication**: Add secure user management
5. **WebSocket**: Enable real-time communication

## Documentation

See the `docs/` folder in the project root for comprehensive project documentation including:
- System architecture and requirements
- API specifications
- Database schema
- Implementation status

## License

This project is part of a capstone thesis for Legacy College of Compostela.
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
