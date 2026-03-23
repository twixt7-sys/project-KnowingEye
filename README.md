# Knowing Eye

A Full-Stack Session-Guided Web-Based Examination Platform with Integrated Behavior Monitoring System Using Facial and Postural Analysis via Computer Vision.

## 🎯 Project Overview

Knowing Eye is a comprehensive examination platform designed to enhance the integrity and efficiency of online assessments through AI-powered behavioral monitoring. The system combines modern web technologies with computer vision to detect and analyze examinee behavior in real-time.

### Key Features
- **Web-Based Examinations**: Complete exam creation, administration, and taking platform
- **Real-Time Monitoring**: AI-powered facial and posture analysis using computer vision
- **Behavior Analytics**: Automated detection of suspicious activities during exams
- **Administrative Dashboard**: Comprehensive monitoring and reporting tools
- **Session Management**: Secure exam sessions with timer and submission tracking

## 📁 Project Structure

```
project-KnowingEye/
├── docs/                    # Project documentation
│   ├── backend/            # Backend API specifications
│   ├── database/           # Database schema and design
│   ├── frontend/           # Frontend architecture docs
│   └── general/            # Project overview and planning
├── my-app/                 # Frontend React application
│   ├── src/               # Source code
│   ├── public/            # Static assets
│   └── package.json       # Dependencies
└── README.md              # This file
```

## 🚀 Current Implementation Status

### ✅ Completed (Frontend Prototype)
- Modern React/TypeScript user interface
- Complete exam flow simulation
- Responsive design with dark/light themes
- Mock behavior monitoring alerts
- All major pages and navigation

### 🔄 Planned (Backend & AI Integration)
- Django REST API backend
- PostgreSQL database
- Real-time webcam capture
- Computer vision analysis (YOLO, CNN, FaceNet)
- WebSocket communication
- User authentication and security

## 🛠️ Technology Stack

### Frontend (Implemented)
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** + **shadcn/ui** for styling
- **React Router** for navigation
- **Material-UI** for additional components

### Backend (Planned)
- **Django** with Python
- **PostgreSQL** database
- **Django REST Framework** for API
- **WebSocket** for real-time features

### AI/ML (Planned)
- **YOLO** for object detection
- **CNN** for feature extraction
- **FaceNet/ArcFace** for facial recognition
- **Computer Vision** libraries

## 📖 Documentation

Comprehensive documentation is available in the `docs/` folder:

- **[System Overview](docs/general/Knowing Eye Overview.txt)** - Project vision and significance
- **[Project Details](docs/general/Project.json)** - Technical specifications and requirements
- **[Implementation Status](docs/general/Implementation_Status_Summary.md)** - Current vs planned features
- **[API Specifications](docs/backend/)** - Backend API design
- **[Database Schema](docs/database/)** - Data model design
- **[Frontend Architecture](docs/frontend/)** - UI/UX implementation details

## 🏃‍♂️ Quick Start

### Frontend Development
```bash
cd my-app
npm install
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) to view the application.

## 🎓 Academic Context

This project is developed as a capstone thesis for the **Institute of Information Technology** at **Legacy College of Compostela**, Davao de Oro, Philippines.

**Team Members:**
- Saturnino C. Ancog III
- Khrisha Marie O. Cavan
- Kervy N. Cadiente
- Twixt Jasley J. Tamera

## 📄 License

This project is part of an academic capstone thesis. See individual component licenses for details.

## 📞 Contact

For questions about this project, please refer to the comprehensive documentation in the `docs/` folder or contact the development team. 
