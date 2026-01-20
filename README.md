# Paperless Client

A mobile-first React Native application for creating and managing invoices through voice recording. Built with Expo and primarily tested on iOS.

## Overview

Paperless Client is a mobile application that streamlines invoice creation by allowing users to record invoice details via voice, which are then processed and converted into structured invoices. The app provides real-time updates on invoice processing status through WebSocket connections and offers full invoice management capabilities.

## Features

- 🎤 **Voice-to-Invoice**: Record invoice details and automatically generate invoices
- 📱 **Mobile-First Design**: Optimized for mobile devices with a focus on iOS
- 🔐 **Authentication**: Secure user authentication with Supabase
- 🏢 **Company Management**: Set up and manage company information
- 📄 **Invoice Management**: View, search, and manage all your invoices
- 📊 **Real-time Updates**: Live status updates via WebSocket for invoice processing
- 📲 **PDF Viewing & Sharing**: View and share invoice PDFs directly from the app
- 🎨 **Modern UI**: Built with NativeWind (Tailwind CSS for React Native)

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation (Stack & Bottom Tabs)
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind CSS)
- **Authentication**: Supabase
- **HTTP Client**: Axios
- **WebSocket**: STOMP over SockJS
- **Audio**: Expo Audio
- **Icons**: Lucide React Native

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Xcode](https://developer.apple.com/xcode/) (for iOS development)
- [Expo Go](https://expo.dev/client) app on your iOS device (for testing)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd paperless-client
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory based on the `env-example` file:

```bash
cp env-example .env
```

Configure the following environment variables:

```env
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_KEY=<your-supabase-key>
EXPO_PUBLIC_API_URL=<paperless-backend-url>
EXPO_PUBLIC_WS_URL=<paperless-backend-websocket-url>
```

**Required Services:**
- **Supabase**: Authentication and database backend
- **Paperless Backend**: API server for invoice processing
- **WebSocket Server**: Real-time job status updates

### 4. Start the Development Server

```bash
npm start
```

This will start the Expo development server and display a QR code in your terminal.

### 5. Run on iOS

#### Using Expo Go (Recommended for Development)

1. Install Expo Go from the App Store on your iOS device
2. Scan the QR code displayed in your terminal using the Camera app
3. The app will open in Expo Go

#### Using iOS Simulator

```bash
npm run ios
```

This will launch the app in the iOS Simulator (requires Xcode).

#### Using Physical Device (Development Build)

For features that require native permissions (like microphone access), you may need to create a development build:

```bash
npx expo run:ios
```

## Application Structure

```
paperless-client/
├── App.tsx                 # Main application component
├── index.ts               # Entry point
├── src/
│   ├── api/              # API client and service layer
│   ├── auth/             # Authentication utilities
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── navigation/       # Navigation configuration
│   ├── screens/          # Screen components
│   ├── store/            # Zustand state management
│   └── websocket/        # WebSocket service
├── assets/               # Images, fonts, and static files
├── app.json             # Expo configuration
└── package.json         # Dependencies and scripts
```

## Key Screens

- **Login/Register**: User authentication
- **Company Setup**: Configure company details for invoices
- **Recording**: Voice recording interface for creating invoices
- **Invoices**: List and manage all invoices
- **Invoice Detail**: View detailed invoice information and PDF
- **Settings**: App configuration and account management

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run on web browser (limited functionality)

## Permissions

The app requires the following permissions:

- **Microphone Access** (iOS): Required for voice recording functionality
  - Configured in `app.json` with `NSMicrophoneUsageDescription`

## Platform Support

- ✅ **iOS**: Primary platform, fully tested
- ⚠️ **Android**: Supported but not extensively tested
- ⚠️ **Web**: Limited support (mobile features may not work)

## Backend Requirements

This client application requires a backend server that provides:

1. **RESTful API** endpoints for:
   - User authentication (via Supabase)
   - Company management
   - Invoice creation and management
   - Voice file upload and processing

2. **WebSocket** connection for:
   - Real-time invoice processing status updates
   - Job status notifications

Ensure your backend server is running and accessible before using the app.

## Troubleshooting

### Audio Recording Issues

If microphone permissions are not working:
1. Check that microphone permissions are granted in iOS Settings
2. Verify `NSMicrophoneUsageDescription` is set in `app.json`
3. For physical devices, ensure you're using a development build, not Expo Go

### Connection Issues

If the app cannot connect to the backend:
1. Verify all environment variables in `.env` are correct
2. Ensure the backend server is running and accessible
3. Check network connectivity
4. For local development, ensure your device/simulator can reach the backend URL

### Build Errors

If you encounter build errors:
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start -c
```
