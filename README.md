# Analytical Hub 📊🏗️

**Analytical Hub** is a powerful, web-based BIM analytics application designed to bridge the gap between 3D Building Information Models (BIM) and actionable data insights. Built on **Autodesk Platform Services (APS)**, it allows users to create custom, interactive dashboards that synchronize 3D navigation with real-time data visualization.

![Dashboard Preview](https://img.shields.io/badge/AEC-Analytics-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite)
![APS](https://img.shields.io/badge/APS-Viewer-FF9D00?style=for-the-badge)

## 🚀 Key Features

### 1. **Interactive 3D Viewer**
* Integrated **APS Forge Viewer** for high-performance 3D BIM visualization.
* **Interaction Sync**: Selecting elements in the 3D model automatically updates linked charts and tables. Conversely, clicking chart segments isolates and colors corresponding elements in the viewer.

### 2. **Dynamic Dashboard Builder**
* **Drag-and-Drop Layout**: Customize your workspace using a responsive grid system.
* **Multi-Component Support**: 
    - **Pie & Bar Charts**: Distribute data by any model property (Category, Level, Material, etc.).
    - **KPI Cards**: Track critical project metrics like total element counts or summed values.
    - **Data Tables**: Detailed tabular views with real-time searching and filtering.
    - **Model Filters**: Powerful property-based filtering to slice your BIM data instantly.

### 3. **Robust Data Engine**
* **4-Layer Property Discovery**: Optimized to find properties even in large or slow-loading models, utilizing:
    1. AEC Data Model (GraphQL)
    2. Deep PDB (Property Database) Scanning
    3. Representative Element Sampling
* **Intelligent Gating**: Components wait for model indexing to complete before attempting to aggregate data, eliminating race conditions.

### 4. **Professional Sharing & Export**
* **HTML Export**: Download your entire dashboard as a standalone, self-contained HTML file.
* **Sleek Aesthetics**: Premium dark-mode design with smooth animations powered by Framer Motion.

---

## 🛠️ Technical Stack

*   **Frontend**: React 19, Vite, Tailwind CSS
*   **Visualization**: Chart.js, React-ChartJS-2
*   **3D Engine**: Autodesk Platform Services (APS) Viewer SDK
*   **Animations**: Framer Motion
*   **Storage**: Browser LocalStorage for dashboard persistence

---

## 📦 Getting Started

### Prerequisites
*   An **Autodesk APS** account and a registered application (Client ID/Secret).
*   **Node.js** (v18+) and **npm** installed.

### Installation
1. Clone the repository (or extract the source).
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration
Create a `.env` file in the root directory:
```env
VITE_APS_CLIENT_ID=your_client_id
VITE_APS_CLIENT_SECRET=your_client_secret
VITE_APS_CALLBACK_URL=http://localhost:5173/callback
VITE_APS_SCOPES=data:read viewables:read
```

### Run Locally
```bash
npm run dev
```

---

## 📂 Project Structure

```text
analytical-hub/
├── src/
│   ├── components/
│   │   ├── charts/        # Pie, Bar, Table, KPI components
│   │   ├── dashboard/     # Builder and View logic
│   │   ├── viewer/        # APS Viewer and File Explorer
│   │   └── ai/            # Integrated AI ChatBot
│   ├── services/
│   │   ├── analyticsService.js # Data aggregation & property scanning
│   │   ├── apsService.js       # APS Authentication & APIs
│   │   └── storageService.js   # Dashboard persistence
│   └── utils/
│       └── exportUtils.js      # Standalone HTML generation
└── .env                   # Configuration variables
```

---

## 📝 License
This project is for demonstration and internal analytical use. Ensure compliance with Autodesk Platform Services terms of use.

---
*Created with ❤️ by the Analytical Hub Team*
