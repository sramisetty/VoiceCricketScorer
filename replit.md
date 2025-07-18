# Voice-Enabled Cricket Scoring App

## Overview

This is a full-stack web application for real-time cricket scoring with voice recognition capabilities. The app enables users to score cricket matches using voice commands, manual input, or a combination of both, while providing live scoreboard updates through WebSocket connections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: Radix UI primitives with Tailwind CSS styling (shadcn/ui design system)
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints with WebSocket support for real-time updates
- **Database**: PostgreSQL with Drizzle ORM for persistent data storage
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Data Layer**: DatabaseStorage class implementing complete CRUD operations

## Key Components

### Voice Recognition System
- **Speech-to-Text**: Browser Web Speech API for real-time transcription
- **Cricket Command Parser**: Custom NLP parser for cricket-specific phrases
- **Confidence Scoring**: Commands filtered by confidence levels to ensure accuracy
- **Noise Handling**: Designed to work with ambient cricket ground sounds

### Database Schema
- **Database**: PostgreSQL with Drizzle ORM for persistent data storage
- **Teams**: Store team information and roster data
- **Players**: Individual player records with roles and batting order
- **Matches**: Match setup, toss results, and current status
- **Innings**: Inning-specific data including runs, wickets, and overs
- **Balls**: Ball-by-ball tracking with detailed scoring information
- **Player Stats**: Real-time batting and bowling statistics

### Real-Time Features
- **WebSocket Server**: Live score updates using ws library
- **Connection Management**: Match-specific client grouping
- **Fallback Polling**: Automatic fallback to REST API when WebSocket unavailable
- **Auto-Reconnection**: Automatic reconnection on connection loss

### UI Components
- **Match Setup**: Team creation, player lineup, and toss configuration
- **Scorer Interface**: Combined voice and manual scoring interface
- **Live Scoreboard**: Public scoreboard for spectators
- **Commentary System**: Ball-by-ball commentary generation
- **Statistics Display**: Real-time batting and bowling figures

## Data Flow

1. **Match Setup**: Users create teams, add players, and configure match settings
2. **Voice Input**: Speech recognition captures cricket commands
3. **Command Processing**: NLP parser converts speech to structured cricket events
4. **Database Update**: Ball and player statistics are updated in real-time
5. **WebSocket Broadcast**: Live data is pushed to all connected clients
6. **UI Updates**: All interfaces reflect changes immediately

## External Dependencies

### Core Libraries
- **React Ecosystem**: React, React DOM, React Router (Wouter)
- **UI Framework**: Radix UI primitives, Tailwind CSS, shadcn/ui components
- **Data Fetching**: TanStack Query for server state management
- **Database**: Drizzle ORM, Neon Database serverless driver
- **Real-Time**: WebSocket (ws) for live updates
- **Voice Recognition**: Web Speech API (browser native)

### Development Tools
- **Build System**: Vite with React plugin
- **TypeScript**: Full TypeScript support across stack
- **Database Migration**: Drizzle Kit for schema management
- **Development Server**: Express with Vite middleware integration

## Deployment Strategy

### Development
- **Local Development**: Vite dev server with Express backend
- **Hot Module Replacement**: Instant updates during development
- **Database**: Neon Database for consistent development environment

### Production
- **Build Process**: Vite builds optimized React bundle, esbuild compiles Express server
- **Static Assets**: Frontend built to `dist/public` directory
- **Server Bundle**: Backend compiled to `dist/index.js`
- **Database**: PostgreSQL with Drizzle ORM migrations
- **Environment**: Node.js runtime with environment variable configuration

### Key Features
- **Voice-First Design**: Primary interaction through voice commands
- **Real-Time Updates**: WebSocket-based live scoring
- **Mobile Responsive**: Works on all device sizes
- **Offline Capability**: Local state management with sync when connected
- **Cricket-Specific**: Tailored for cricket scoring terminology and rules