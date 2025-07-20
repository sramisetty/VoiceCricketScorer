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
- **Runs-Only Parser**: Streamlined parser focused exclusively on run-scoring commands
- **Enhanced Phonetic Patterns**: Comprehensive phonetic matching for all run types
- **Supported Commands**: "dot ball", "single", "double", "triple", "four", "six", "boundary", "maximum"
- **Misinterpretation Handling**: "dark" → "dot", "florence" → "four", "sex" → "six", "trouble" → "double"
- **Number Recognition**: "one run", "two runs", "three runs", "four runs", "six runs"
- **Alternative Phrases**: "maximum" → "six", "boundary" → "four", "no run" → "dot ball"
- **Visual Feedback**: Real-time transcript display and command interpretation
- **High Confidence Scoring**: Enhanced accuracy with phonetic correction boosting
- **Noise Handling**: Designed to work with ambient cricket ground sounds

### Comprehensive Scoring System with ICC Rules
- **Advanced Scorer**: Multi-tab interface with quick scoring, detailed entry, and extras handling
- **ICC Cricket Rules Engine**: Comprehensive implementation of ICC Playing Conditions 2019-20
- **Automatic Rule Validation**: Real-time validation of all balls against ICC cricket rules
- **Penalty Runs System**: Automatic calculation and application of penalty runs for rule violations
- **Over Management**: Proper 6-ball over validation with consecutive over prevention (ICC Rule 17.6)
- **Strike Rotation**: Automatic ICC-compliant strike rotation on odd runs and end-of-over changes
- **Wide & No Ball Handling**: Automatic penalty run application with enhanced commentary
- **Dead Ball & Short Run Detection**: Complete ICC rule validation for all ball scenarios
- **Dismissal Validation**: Verification of all wicket types against ICC permitted dismissal methods
- **Voice Integration**: Advanced voice commands trigger appropriate UI dialogs and actions
- **Wicket Handling**: Voice input removed for wickets; detailed wicket tracking through advanced scorer only
- **Match Statistics**: Real-time batting, bowling, and partnership analytics
- **Player Statistics**: Individual performance tracking with strike rates and economy rates
- **Ball-by-Ball Tracking**: Complete ball tracking with enhanced commentary generation
- **Undo/Redo Functionality**: Ability to correct scoring mistakes with proper rule reversal
- **Batsman Replacement**: Automatic dialog for selecting next batsman when wickets fall
- **Smart Command Routing**: Voice commands automatically open relevant dialogs (bowler change, timeout, etc.)

### Database Schema
- **Database**: PostgreSQL with Drizzle ORM for persistent data storage with ICC-compliant fields
- **Teams**: Store team information and roster data
- **Players**: Individual player records with roles and batting order
- **Matches**: Match setup, toss results, and current status
- **Innings**: Inning-specific data including runs, wickets, and overs
- **Balls**: Ball-by-ball tracking with detailed scoring information and ICC rule fields (isShortRun, isDeadBall, penaltyRuns, batsmanCrossed)
- **Player Stats**: Real-time batting and bowling statistics with ICC-compliant dismissal tracking (dismissalType, fielderId, maidenOvers, wideBalls, noBalls)

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
- **Innings Management**: Automatic innings completion detection and second innings start
- **Team Display**: Clear indication of which team is batting in headers
- **Centralized Undo**: Quick Actions panel with consolidated undo functionality
- **Mobile Responsive**: Works on all device sizes
- **Offline Capability**: Local state management with sync when connected
- **Cricket-Specific**: Tailored for cricket scoring terminology and rules

## Recent Changes (January 2025)
### January 20, 2025
- **✓ PostgreSQL Authentication Fix**: Resolved "ident authentication failed" error with proper database setup
- **✓ PM2 Configuration Fix**: Fixed ecosystem.config.js to .cjs format to resolve ES modules conflict with PM2
- **✓ Successful Production Deployment**: Application running successfully with PM2 cluster mode
- **✓ Database Migration Success**: Drizzle-kit successfully connected and migrated database schema
- **✓ PM2 Process Management**: Cricket-scorer application running online with auto-restart capabilities
- **✓ Nginx Reverse Proxy Setup**: Complete Nginx configuration with SSL support for public IP 67.227.251.94
- **✓ SSL Configuration**: Let's Encrypt SSL certificate generation and domain configuration
- **✓ Production Web Server**: HTTP/HTTPS access with WebSocket support and security headers
- **✓ NPM Dependency Resolution**: PostCSS/autoprefixer version conflict resolution with proper TypeScript configurations
- **✓ Production-Ready Configuration**: Complete infrastructure setup for score.ramisetty.net (67.227.251.94) with firewall, Nginx reverse proxy, and automatic SSL certificate generation
- **✓ Deployment Scripts Cleanup**: Removed all shell scripts per user request to eliminate deployment complexity
- **✓ Project Structure Cleanup**: Removed duplicate cricket-scorer-deploy folder to maintain clean project structure
- **✓ Static Asset 404 Root Cause Identified**: Express server looks for static files in server/public/ but Vite builds to dist/public/ causing 404 errors
- **✓ Comprehensive Production Fix**: Updated production-deploy.sh to build static assets directly to server/public/ where Express expects them
- **✓ Quick Fix Script**: Created quick-fix-production.sh to immediately resolve static asset serving issues on production server
- **✓ Build Process Correction**: Modified deployment scripts to use correct output directory (server/public/) with fallback copying from dist/public/
- **→ Production Deployment Testing**: Ready to test fixes on production server to resolve React app loading and enable full Cricket Scorer functionality

### January 19, 2025
- **✓ Production PM2 Deployment System**: Created comprehensive deploy-pm2.sh with PM2 process management, clustering, and SSL automation
- **✓ Node.js Conflict Resolution**: Fixed Node.js version conflicts on CentOS/RHEL systems with proper package removal and --allowerasing
- **✓ Multi-Platform Deployment System**: Updated deployment scripts to support Ubuntu/Debian (apt), CentOS/RHEL (yum), and Fedora (dnf)
- **✓ Comprehensive Production Deployment System**: Created complete Linux deployment scripts similar to poker ledger project
- **✓ Main Deployment Script**: Full production setup with Node.js, PostgreSQL, Nginx, security, and automated backups
- **✓ Update Script**: Safe application updates preserving data and configuration
- **✓ Monitoring System**: Health checks, log management, performance metrics, and automated monitoring
- **✓ SSL Automation**: Let's Encrypt SSL certificate setup with automatic renewal
- **✓ Security Hardening**: Firewall, fail2ban, security headers, and system protection
- **✓ Backup System**: Automated daily backups with 7-day retention
- **✓ Complete Documentation**: Comprehensive deployment guide with troubleshooting
- **✓ Complete ICC Cricket Rules Implementation**: Implemented comprehensive ICC Playing Conditions 2019-20 with full rule validation engine
- **✓ Enhanced Database Schema**: Added ICC-compliant fields (isShortRun, isDeadBall, penaltyRuns, batsmanCrossed, dismissalType, maidenOvers, wideBalls, noBalls)
- **✓ Cricket Rules Engine**: Created dedicated cricket-rules.ts module with complete ICC rule validation for all scenarios
- **✓ Automatic Rule Application**: Wide balls and no balls automatically apply penalty runs with proper commentary generation
- **✓ Over Management**: Proper 6-ball over validation with extra ball handling for wides and no-balls
- **✓ Consecutive Over Prevention**: Enforced ICC Rule 17.6 preventing same bowler from bowling consecutive overs
- **✓ Strike Rotation Logic**: Implemented proper ICC Rule 18 for strike rotation on odd runs and end-of-over changes
- **✓ Penalty Runs System**: Complete ICC Rule 18.6 penalty runs calculation for all rule violations
- **✓ Dismissal Validation**: Validated dismissal types against ICC permitted dismissal methods
- **✓ Dead Ball Handling**: ICC Rule 20 dead ball validation with proper run nullification
- **✓ Short Run Detection**: ICC Rule 18.4/18.5 for unintentional and deliberate short runs with penalties
- **✓ Wicket Limit Enforcement**: Maximum 10 wickets per innings validation
- **✓ Clear Match Data Functionality**: Added comprehensive API endpoint to reset all balls, runs, and player statistics while preserving team setup
- **✓ Database Reset Logic**: Implemented complete match data clearing that resets innings totals, player stats, and match status to 'not_started'
- **✓ Clear Match Button**: Added and then removed Clear Match Data button from Quick Actions panel per user request
- **✓ Current Over Display Fix**: Resolved inconsistency between Current Over widget and Advanced Scorer ball counts by using same calculation method
- **✓ Enhanced Undo Functionality**: Fixed undo to properly revert current bowler when undoing first ball of an over with enhanced strike rotation reversal
- **✓ Cricket Rule Enforcement**: Implemented validation preventing same bowler from bowling consecutive overs with comprehensive error handling
- **✓ Strike Rotation Reversal**: Fixed undo functionality to properly reverse batsman strike rotation when odd runs are undone
- **✓ Switch Strike Functionality**: Added manual strike switching capability with dedicated API endpoint and Quick Actions button
- **✓ Enhanced Quick Actions**: Reorganized Quick Actions panel with grid layout for Undo and Switch Strike buttons
- **✓ ICC-Compliant Statistics**: Updated batsman and bowler statistics tracking with complete ICC rule compliance for wide balls, no-balls, and maiden overs
- **✓ Comprehensive Ball Counting**: Fixed over management to properly count only valid balls toward 6-ball limit, extras repeat ball numbers
- **✓ Automatic Over Completion**: Implemented end-of-over detection with automatic strike rotation and maiden over tracking
- **✓ Bye/Leg-bye Implementation**: Added complete ICC Rule 23 support for bye and leg-bye runs with proper run attribution
- **✓ Comprehensive Bowler Dialog Fix**: Complete redesign of bowler change logic with ICC Rule 17.6 compliance
- **✓ Smart Dialog Triggering**: Dialog only appears when same bowler tries to bowl consecutive overs (ICC violation)
- **✓ Force Dialog Closure**: Added multiple mechanisms to ensure dialog closes after successful bowler change
- **✓ Improved UX**: Clearer messaging about ICC Rule 17.6 requirement for bowler changes

### January 18, 2025
- **✓ Innings Completion Logic**: Implemented automatic detection when 10 wickets fall or overs complete
- **✓ Second Innings Auto-Start**: Teams automatically swap roles for second innings
- **✓ Header Team Display**: Shows current innings number and batting team in scorer and scoreboard
- **✓ Centralized Undo**: Moved undo functionality from multiple locations to Quick Actions panel
- **✓ Match Completion**: Automatic match status update when both innings complete
- **✓ Notification System**: Toast notifications for innings completion and match completion
- **✓ WebSocket Events**: Added support for innings_complete and match_complete events
- **✓ Opener Selection Fix**: Fixed critical issue where wrong second batsman was displayed during opener selection
- **✓ Batting Statistics Accuracy**: Resolved "1 balls" display issue - now shows accurate "0 balls" when no deliveries bowled
- **✓ Database Synchronization**: Implemented temporary marker system (-1 ballsFaced) to distinguish selected openers from other players
- **✓ Voice Recognition Enhancement**: Added phonetic pattern matching to handle misinterpretations ("dark" → "dot", "florence" → "four")
- **✓ Visual Command Feedback**: Improved voice input interface with color-coded interpretation display and confidence indicators
- **✓ Speech Recognition Optimization**: Enhanced accuracy with multiple alternatives and better final result processing
- **✓ Voice Recognition Rollback**: Restored standard web speech recognition for reliable voice input
- **✓ Cricket Parser Enhancement**: Maintained advanced phonetic pattern matching for improved accuracy
- **✓ Voice Commands Restriction**: Limited voice commands to runs-only for better accuracy and simplicity
- **✓ Enhanced Phonetic Patterns**: Expanded phonetic matching for dot balls, singles, doubles, triples, fours, and sixes
- **✓ Improved Voice Recognition**: Better handling of common misinterpretations like "dark" → "dot", "florence" → "four", "sex" → "six"
- **✓ Comprehensive Documentation**: Created elaborate README.md with complete app explanation, setup instructions, and feature documentation