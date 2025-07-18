# Voice-Enabled Cricket Scoring App

A sophisticated, real-time cricket scoring platform that revolutionizes match scoring through intelligent voice recognition and comprehensive match management. Built with modern web technologies and designed for cricket enthusiasts, scorers, and spectators.

## 🏏 Overview

This full-stack web application combines advanced voice recognition with intuitive manual scoring to provide a seamless cricket scoring experience. The app supports complete match management from team setup to final results, with real-time updates and comprehensive statistics tracking.

## ✨ Key Features

### 🎙️ Voice Recognition System
- **Browser-Based Speech Recognition**: Utilizes Web Speech API for reliable, real-time voice input
- **Runs-Only Commands**: Streamlined voice commands focused exclusively on run scoring for maximum accuracy
- **Enhanced Phonetic Matching**: Advanced pattern recognition handles common misinterpretations
- **Smart Corrections**: Automatically converts "dark" → "dot", "florence" → "four", "sex" → "six"
- **Multiple Command Formats**: Supports various ways to express the same command
  - "dot ball", "no run", "maiden"
  - "single", "one run", "quick single"
  - "double", "two runs", "easy two"
  - "four", "boundary", "four runs"
  - "six", "maximum", "six runs"

### 📊 Comprehensive Scoring System
- **Advanced Scorer Interface**: Multi-tab interface with quick scoring and detailed entry
- **Real-Time Match Statistics**: Live batting averages, bowling figures, and partnership tracking
- **Ball-by-Ball Commentary**: Automatic commentary generation for every delivery
- **Innings Management**: Automatic detection of innings completion and second innings setup
- **Smart Undo System**: Centralized undo functionality in Quick Actions panel
- **Wicket Tracking**: Detailed wicket information with fielder details

### 🏆 Match Management
- **Complete Match Setup**: Team creation, player lineups, and toss configuration
- **Live Scoreboard**: Public scoreboard for spectators with real-time updates
- **Match Selection**: Easy selection between multiple ongoing matches
- **Opener Selection**: Streamlined process for selecting opening batsmen
- **Over Management**: Automatic over completion detection and bowler rotation
- **Match Completion**: Automatic status updates when matches conclude

### 📱 Real-Time Features
- **WebSocket Integration**: Live score updates using WebSocket connections
- **Automatic Reconnection**: Resilient connection management with fallback polling
- **Match-Specific Updates**: Targeted updates for specific match viewers
- **Cross-Device Synchronization**: Seamless updates across all connected devices

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe development
- **Vite** for fast development and optimized builds
- **TanStack Query** for efficient server state management
- **Wouter** for lightweight client-side routing
- **Tailwind CSS** with shadcn/ui components for beautiful, responsive design
- **Radix UI** primitives for accessible component foundations

### Backend
- **Node.js** with Express.js for robust server architecture
- **TypeScript** with ESM modules for modern JavaScript development
- **PostgreSQL** with Neon Database for reliable data persistence
- **Drizzle ORM** for type-safe database operations
- **WebSocket (ws)** for real-time communication

### Voice Recognition
- **Web Speech API** for browser-based speech recognition
- **Custom Cricket Parser** with phonetic pattern matching
- **Confidence Scoring** for accurate command interpretation
- **Noise Filtering** designed for cricket ground environments

## 🏗️ Architecture

### Data Flow
1. **Match Setup**: Create teams, add players, configure match settings
2. **Voice/Manual Input**: Capture scoring commands through voice or manual entry
3. **Command Processing**: Parse and validate cricket commands with confidence scoring
4. **Database Updates**: Store ball-by-ball data and update statistics
5. **Real-Time Broadcast**: Push updates to all connected clients via WebSocket
6. **UI Updates**: Reflect changes across scorer, scoreboard, and statistics views

### Database Schema
- **Teams**: Store team information, logos, and roster data
- **Players**: Individual player records with roles and batting positions
- **Matches**: Match configuration, toss results, and current status
- **Innings**: Inning-specific data including runs, wickets, and overs
- **Balls**: Comprehensive ball-by-ball tracking with detailed information
- **Statistics**: Real-time batting and bowling performance metrics

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- Modern web browser with Web Speech API support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice-cricket-scoring
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Database configuration
   DATABASE_URL=your_postgresql_connection_string
   
   # Optional: OpenAI API key for enhanced features
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000` to access the application

### Production Deployment

The app is optimized for deployment on Replit and other modern hosting platforms:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## 📖 Usage Guide

### Setting Up a Match

1. **Create Teams**: Add team names, abbreviations, and optional logos
2. **Add Players**: Create player rosters with names and batting positions
3. **Configure Match**: Set match type, overs, and toss details
4. **Select Openers**: Choose opening batsmen for the first innings

### Scoring with Voice Commands

1. **Start Voice Recognition**: Click the microphone button in the scorer interface
2. **Speak Clearly**: Use natural cricket terminology
3. **Confirm Commands**: Review interpreted commands before submission
4. **Supported Commands**:
   - "dot ball" or "no run"
   - "single" or "one run"
   - "double" or "two runs"
   - "four" or "boundary"
   - "six" or "maximum"

### Managing the Match

- **Quick Actions**: Access undo, timeout, and other quick functions
- **Advanced Scorer**: Use detailed entry for complex scenarios
- **Live Updates**: Monitor real-time statistics and commentary
- **Match Completion**: Automatic detection and status updates

### Viewing Live Scores

- **Scoreboard**: Public view optimized for spectators
- **Statistics**: Detailed batting and bowling figures
- **Commentary**: Ball-by-ball match commentary
- **Match History**: Complete over-by-over breakdown

## 🔧 Configuration

### Voice Recognition Settings
- Adjust confidence thresholds for command acceptance
- Customize phonetic patterns for better accuracy
- Enable/disable specific command types

### Database Configuration
- PostgreSQL connection settings
- Automatic schema migrations
- Data backup and recovery options

### Real-Time Features
- WebSocket connection settings
- Fallback polling intervals
- Client reconnection policies

## 🤝 Contributing

We welcome contributions to improve the Voice-Enabled Cricket Scoring App! Here's how you can help:

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Areas for Contribution
- **Voice Recognition**: Improve phonetic patterns and accuracy
- **UI/UX**: Enhance user interface and experience
- **Features**: Add new cricket-specific functionality
- **Performance**: Optimize real-time updates and database queries
- **Documentation**: Improve guides and API documentation

## 📝 API Documentation

### REST Endpoints

#### Teams
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create a new team
- `GET /api/teams/:id` - Get team details
- `PUT /api/teams/:id` - Update team information

#### Matches
- `GET /api/matches` - List all matches
- `POST /api/matches` - Create a new match
- `GET /api/matches/:id/live` - Get live match data
- `POST /api/matches/:id/score` - Submit scoring data

#### Players
- `GET /api/players` - List all players
- `POST /api/players` - Create a new player
- `GET /api/players/:id/stats` - Get player statistics

### WebSocket Events

#### Client → Server
- `join_match` - Join a specific match room
- `score_update` - Submit new scoring data
- `match_event` - Trigger match events

#### Server → Client
- `score_update` - Live score updates
- `match_event` - Match status changes
- `player_stats` - Updated player statistics

## 🐛 Troubleshooting

### Common Issues

**Voice Recognition Not Working**
- Ensure microphone permissions are granted
- Check browser compatibility (Chrome recommended)
- Verify microphone is not muted or blocked

**Database Connection Issues**
- Verify DATABASE_URL environment variable
- Check PostgreSQL server status
- Ensure proper network connectivity

**Real-Time Updates Not Appearing**
- Check WebSocket connection status
- Verify network connectivity
- Clear browser cache and reload

### Performance Optimization

**Voice Recognition Accuracy**
- Speak clearly and at moderate pace
- Use standard cricket terminology
- Minimize background noise

**Database Performance**
- Regular database maintenance
- Optimize query patterns
- Monitor connection pooling

## 📊 Statistics and Analytics

The app provides comprehensive match statistics:

### Batting Statistics
- Runs scored, balls faced, strike rate
- Boundaries (4s and 6s) hit
- Partnership details and run rates
- Individual player performance trends

### Bowling Statistics
- Overs bowled, runs conceded, wickets taken
- Economy rate and bowling average
- Dot ball percentage and pressure metrics
- Over-by-over bowling analysis

### Match Analytics
- Run rate progression throughout innings
- Wicket fall patterns and timing
- Partnership contributions and durations
- Historical performance comparisons

## 🔒 Privacy and Security

- **Data Protection**: All match data is securely stored
- **User Privacy**: No personal data collection beyond match participation
- **Secure Communication**: WebSocket connections use secure protocols
- **Database Security**: Encrypted connections and secure access controls

## 📱 Mobile Compatibility

The app is fully responsive and optimized for mobile devices:

- **Touch-Friendly Interface**: Large buttons and intuitive gestures
- **Voice Recognition**: Works seamlessly on mobile browsers
- **Offline Capability**: Basic functionality available without internet
- **Performance Optimized**: Fast loading and smooth interactions

## 🎯 Future Enhancements

### Planned Features
- **Enhanced Voice Commands**: Support for wickets, extras, and complex scenarios
- **Video Integration**: Match highlights and key moment capture
- **Advanced Analytics**: Machine learning-powered insights
- **Multi-Language Support**: Voice recognition in multiple languages
- **Tournament Management**: Complete tournament and league support

### Technical Improvements
- **Offline Mode**: Full offline functionality with sync capabilities
- **Performance Optimization**: Faster load times and smoother interactions
- **Enhanced Security**: Advanced authentication and authorization
- **Scalability**: Support for concurrent matches and large user bases

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Cricket Community**: For invaluable feedback and feature requests
- **Open Source Libraries**: Amazing tools that make this app possible
- **Beta Testers**: Early adopters who helped refine the experience
- **Contributors**: Everyone who has contributed code, ideas, or feedback

## 📞 Support

For support, feature requests, or bug reports:

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Join community discussions for general questions
- **Documentation**: Check the wiki for detailed guides and tutorials
- **Contact**: Reach out to the maintainers for direct support

---

**Built with ❤️ for the cricket community**

*Revolutionizing cricket scoring through voice technology and intelligent automation*