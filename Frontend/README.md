# CRYVEX Frontend

A clean, professional React dashboard for the CRYVEX blockchain-enabled ETL platform.

## 🎨 Design Features

- **Light Theme**: Pink/Cream/Skin color palette
- **Clean & Minimal**: Professional design with no clutter
- **Responsive**: Mobile-friendly layout
- **Modern**: React 18 + Vite for fast development

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Backend API running on `http://localhost:8000`

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` to match your backend URL:
```env
VITE_API_URL=http://localhost:8000/v1
VITE_WS_URL=ws://localhost:8000
VITE_ENVIRONMENT=development
```

3. **Start development server**
```bash
npm run dev
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The optimized build will be in the `dist` folder.

## 📁 Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components
│   ├── layout/          # Layout components (Navbar, Sidebar)
│   ├── auth/            # Authentication components
│   └── ...
├── pages/               # Page components
├── services/            # API service layer
├── context/             # React Context providers
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
└── styles/              # Global styles & CSS variables
```

## 🎯 Key Features

### Implemented
✅ User authentication (Login/Register)
✅ Protected routes
✅ Dashboard with stats overview
✅ Pipeline management (list view)
✅ Clean component library
✅ Responsive design
✅ API integration setup

### Component Library

- **Button**: 5 variants (primary, secondary, outline, ghost, danger)
- **Input**: With labels, validation, error states
- **Card**: Composable card with header/body/footer
- **Badge**: Status indicators
- **Modal**: Dialogs and confirmations
- **Alert**: Toast notifications
- **Spinner**: Loading indicators
- **EmptyState**: Placeholder for empty data

## 🔌 API Integration

The app uses Axios with interceptors for:
- Automatic JWT token injection
- Token refresh on 401 errors
- Global error handling

### Example API Call

```javascript
import { pipelineService } from './services/pipeline.service';

const pipelines = await pipelineService.getAll();
```

## 🎨 Customizing Design

### Colors

Edit `src/styles/variables.css` to change colors:

```css
:root {
  --primary: #FF6B9D;      /* Change primary color */
  --cream: #FFF5F0;        /* Change background */
  --skin: #FFE4D6;         /* Change card color */
}
```

### Components

All components are in `src/components/common/` and can be easily customized.

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/v1` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:8000` |
| `VITE_ENVIRONMENT` | Environment | `development` |

## 🔒 Authentication Flow

1. User logs in → JWT tokens stored in localStorage
2. API requests automatically include Bearer token
3. On 401 error → Attempts token refresh
4. If refresh fails → Redirects to login

## 📱 Pages

- `/login` - User login
- `/register` - User registration
- `/dashboard` - Main dashboard with stats
- `/pipelines` - Pipeline list and management
- `/executions` - Execution logs (TODO)
- `/integrity` - Integrity verification (TODO)
- `/users` - User management (TODO)
- `/settings` - User settings (TODO)

## 🛠️ Development

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation link in `src/components/layout/Sidebar.jsx`

### Creating a New Component

1. Create component in `src/components/common/`
2. Create corresponding CSS file
3. Export from component file

## 🎯 Next Steps

To complete the frontend:

1. **Add remaining pages**:
   - Pipeline Details
   - Pipeline Creation (wizard)
   - Execution Details with real-time logs
   - Integrity Records
   - User Management
   - Settings

2. **Implement WebSocket** for real-time logs
3. **Add form validation** with react-hook-form
4. **Add data visualization** with Recharts
5. **Implement file upload** functionality
6. **Add toast notifications**

## 🐛 Troubleshooting

**Port already in use**
```bash
# Kill process on port 3000
npx kill-port 3000
# Or change port in vite.config.js
```

**API connection errors**
- Ensure backend is running
- Check VITE_API_URL in .env
- Check CORS settings on backend

**Module not found**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

Private - CRYVEX Project

## 👥 Team

Built for CRYVEX FYP by the development team.
