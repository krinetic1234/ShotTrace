# ShotTrace: Real-Time Gunshot Detection & Response System

ShotTrace is an advanced emergency response system designed to minimize Time-to-Capture (TTC) from the moment a gunshot occurs to the moment the suspect is detained. The system transforms raw signals (audio, calls, video) into actionable guidance for first responders through AI-powered signal processing, intelligent footage triage, and real-time analysis.

## 🎯 Mission

**Critical Assumption**: TTC is non-linear - the odds of capturing a suspect drop exponentially after ~20 minutes. ShotTrace addresses this by providing high-fidelity localization and intelligent footage triage to narrow the responder search space.

## 🏗️ System Architecture

### High-Level Flow

1. **Signal Processing & Localization**
   - Process audio signals from multiple microphones (minimum 3 required)
   - Calculate time-difference-of-arrival (TDOA) to pinpoint gunshot coordinates
   - Provide precise location data to narrow search space

2. **Intelligent Footage Triage**
   - AI agents/LLMs analyze the incident location
   - Identify nearby surveillance sources (buildings, homes, businesses)
   - Automatically contact property owners or dispatch units to obtain footage
   - Prioritize footage based on proximity and quality

3. **Parallel Video Analysis**
   - Deploy video models to analyze collected footage simultaneously
   - Generate actionable insights for police:
     - **Suspect Identity**: Rough physical description and characteristics
     - **Direction of Travel**: Where the suspect is headed
     - **Forensic Opportunities**: Compromised areas for evidence collection (shoe prints, fingerprints, etc.)

## 📁 Project Structure

```
ShotTrace/
├── README.md                           # This file - project overview and documentation
├── .gitignore                          # Git ignore rules (excludes .env and other sensitive files)
├── .env                                # Environment variables (not tracked in git)
│
├── footage_analysis/                   # Video processing and AI analysis module
│   ├── models/                         # ML models for video analysis
│   ├── processors/                     # Video processing algorithms
│   └── analyzers/                      # AI-powered content analysis
│
├── footage_collection/                 # Footage acquisition and management
│   ├── sources/                        # Different footage source integrations
│   ├── contacts/                       # Property owner contact management
│   └── dispatch/                       # Police unit coordination
│
├── gunshot_triangulation/              # Core audio processing and localization
│   ├── signal_processing/              # Audio signal analysis algorithms
│   ├── triangulation/                  # TDOA calculation and coordinate mapping
│   └── calibration/                    # Microphone array calibration
│
└── shotrace/                          # Next.js web application
    ├── app/                           # Next.js 15 app directory
    │   ├── layout.tsx                 # Root layout component
    │   ├── page.tsx                   # Main dashboard page
    │   └── globals.css                # Global styles with Tailwind CSS
    ├── public/                        # Static assets
    ├── package.json                   # Dependencies and scripts
    ├── next.config.ts                 # Next.js configuration
    ├── tsconfig.json                  # TypeScript configuration
    └── postcss.config.mjs             # PostCSS configuration for Tailwind
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Python 3.8+ (for ML components)
- Access to surveillance camera networks

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ShotTrace
   ```

2. **Install Next.js dependencies**
   ```bash
   cd shotrace
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔧 Technology Stack

### Frontend (shotrace/)
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **React 19** - Latest React with concurrent features

### Backend Processing
- **Python** - Signal processing and ML models
- **TensorFlow/PyTorch** - Deep learning for video analysis
- **NumPy/SciPy** - Mathematical computations for triangulation
- **OpenCV** - Computer vision for video processing

### Infrastructure
- **Real-time Processing** - Low-latency audio/video analysis
- **Cloud Storage** - Secure footage and data storage
- **API Integration** - Police dispatch and emergency services

## 🎯 Key Features

### Real-Time Gunshot Detection
- **Multi-microphone triangulation** for precise location identification
- **Sub-second detection** and coordinate calculation
- **Automatic incident logging** with timestamp and location data

### Intelligent Footage Collection
- **AI-powered source identification** of nearby cameras
- **Automated contact management** for property owners
- **Priority-based collection** based on proximity and quality

### Advanced Video Analysis
- **Parallel processing** of multiple video streams
- **Suspect identification** with physical descriptions
- **Movement prediction** and direction analysis
- **Forensic opportunity mapping** for evidence collection

### Emergency Response Integration
- **Real-time alerts** to dispatch centers
- **Coordinate sharing** with responding units
- **Evidence preservation** and chain of custody

## 🔒 Security & Privacy

- **Encrypted data transmission** for all sensitive information
- **Secure footage storage** with access controls
- **Privacy-compliant** data handling and retention
- **Audit logging** for all system activities

## 📊 Performance Metrics

- **Detection Latency**: < 2 seconds from gunshot to coordinates
- **Footage Collection**: < 5 minutes to acquire relevant footage
- **Analysis Speed**: < 10 minutes for complete video analysis
- **Accuracy**: > 95% for gunshot detection and localization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Emergency Use

**This system is designed for emergency response situations. In case of an actual emergency, contact local law enforcement immediately.**

## 📞 Support

For technical support or questions about the system:
- Create an issue in the repository
- Contact the development team
- Review the documentation in each module folder

---

**ShotTrace** - Turning raw signals into actionable guidance for emergency responders.
