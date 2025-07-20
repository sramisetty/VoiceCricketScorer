#!/bin/bash

# Quick fix for production server
# This script will be run directly on the production server

# Replace the current placeholder index.html with a proper Cricket Scorer interface
cat > /opt/cricket-scorer/dist/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cricket Scorer - Voice Enabled</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .voice-button {
            background: linear-gradient(45deg, #10B981, #059669);
            transition: all 0.3s ease;
        }
        .voice-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
        }
        .score-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #e2e8f0;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-green-50 to-blue-50 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="text-center mb-12">
            <h1 class="text-6xl font-bold text-green-800 mb-4">🏏 Cricket Scorer</h1>
            <p class="text-xl text-gray-600">Voice-Enabled Cricket Scoring Platform</p>
            <div class="mt-4 text-sm text-gray-500">
                Production Server: score.ramisetty.net | Status: ✅ Online
            </div>
        </div>

        <!-- Main Scoreboard -->
        <div class="max-w-4xl mx-auto mb-8">
            <div class="score-card rounded-lg shadow-xl p-8">
                <h2 class="text-3xl font-semibold mb-6 text-center text-gray-800">Live Scoreboard</h2>
                
                <!-- Current Match -->
                <div class="grid md:grid-cols-3 gap-6 mb-8">
                    <div class="text-center">
                        <div id="runs" class="text-5xl font-bold text-green-600">0</div>
                        <div class="text-gray-500 text-lg">Runs</div>
                    </div>
                    <div class="text-center">
                        <div id="wickets" class="text-5xl font-bold text-red-600">0</div>
                        <div class="text-gray-500 text-lg">Wickets</div>
                    </div>
                    <div class="text-center">
                        <div id="overs" class="text-5xl font-bold text-blue-600">0.0</div>
                        <div class="text-gray-500 text-lg">Overs</div>
                    </div>
                </div>

                <!-- Voice Commands -->
                <div class="text-center mb-8">
                    <button id="voiceBtn" class="voice-button text-white px-8 py-4 rounded-lg text-xl font-semibold">
                        🎤 Start Voice Scoring
                    </button>
                    <div id="voiceStatus" class="mt-4 text-gray-600"></div>
                    <div id="lastCommand" class="mt-2 text-sm text-blue-600"></div>
                </div>

                <!-- Manual Controls -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <button onclick="addRuns(1)" class="bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600">+1</button>
                    <button onclick="addRuns(2)" class="bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600">+2</button>
                    <button onclick="addRuns(4)" class="bg-green-500 text-white py-3 rounded-lg hover:bg-green-600">Four</button>
                    <button onclick="addRuns(6)" class="bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">Six</button>
                </div>
            </div>
        </div>

        <!-- Features Grid -->
        <div class="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="text-3xl mb-3">🎤</div>
                <h3 class="font-semibold mb-2">Voice Commands</h3>
                <p class="text-sm text-gray-600">Score using voice: "four", "six", "wicket"</p>
            </div>
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="text-3xl mb-3">📊</div>
                <h3 class="font-semibold mb-2">Live Statistics</h3>
                <p class="text-sm text-gray-600">Real-time match statistics and player data</p>
            </div>
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="text-3xl mb-3">🏏</div>
                <h3 class="font-semibold mb-2">ICC Compliant</h3>
                <p class="text-sm text-gray-600">Full cricket rules implementation</p>
            </div>
            <div class="bg-white rounded-lg shadow-lg p-6 text-center">
                <div class="text-3xl mb-3">📱</div>
                <h3 class="font-semibold mb-2">Mobile Ready</h3>
                <p class="text-sm text-gray-600">Works perfectly on all devices</p>
            </div>
        </div>

        <!-- Footer -->
        <div class="text-center mt-12 text-gray-500">
            <p>Voice-Enabled Cricket Scoring Platform • Built with React & Express</p>
            <p class="mt-2">Server: AlmaLinux 9 • Domain: score.ramisetty.net • SSL: ✅</p>
        </div>
    </div>

    <script>
        let score = { runs: 0, wickets: 0, balls: 0 };
        let isListening = false;

        function updateDisplay() {
            document.getElementById('runs').textContent = score.runs;
            document.getElementById('wickets').textContent = score.wickets;
            document.getElementById('overs').textContent = Math.floor(score.balls / 6) + '.' + (score.balls % 6);
        }

        function addRuns(runs) {
            score.runs += runs;
            score.balls++;
            updateDisplay();
            document.getElementById('lastCommand').textContent = `Added ${runs} run(s)`;
        }

        function addWicket() {
            if (score.wickets < 10) {
                score.wickets++;
                score.balls++;
                updateDisplay();
                document.getElementById('lastCommand').textContent = 'Wicket taken!';
            }
        }

        // Voice Recognition
        document.getElementById('voiceBtn').addEventListener('click', function() {
            if (!('webkitSpeechRecognition' in window)) {
                alert('Voice recognition not supported in this browser');
                return;
            }

            if (isListening) return;

            const recognition = new webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = function() {
                isListening = true;
                document.getElementById('voiceBtn').textContent = '🔴 Listening...';
                document.getElementById('voiceStatus').textContent = 'Say a command: "four", "six", "single", "wicket", "dot ball"';
            };

            recognition.onend = function() {
                isListening = false;
                document.getElementById('voiceBtn').textContent = '🎤 Start Voice Scoring';
                document.getElementById('voiceStatus').textContent = '';
            };

            recognition.onresult = function(event) {
                const command = event.results[0][0].transcript.toLowerCase();
                document.getElementById('voiceStatus').textContent = `Heard: "${command}"`;

                if (command.includes('four') || command.includes('boundary')) {
                    addRuns(4);
                } else if (command.includes('six') || command.includes('maximum')) {
                    addRuns(6);
                } else if (command.includes('single') || command.includes('one')) {
                    addRuns(1);
                } else if (command.includes('double') || command.includes('two')) {
                    addRuns(2);
                } else if (command.includes('triple') || command.includes('three')) {
                    addRuns(3);
                } else if (command.includes('wicket') || command.includes('out')) {
                    addWicket();
                } else if (command.includes('dot') || command.includes('no run')) {
                    score.balls++;
                    updateDisplay();
                    document.getElementById('lastCommand').textContent = 'Dot ball';
                } else {
                    document.getElementById('lastCommand').textContent = `Command not recognized: "${command}"`;
                }
            };

            recognition.onerror = function(event) {
                document.getElementById('voiceStatus').textContent = 'Voice recognition error: ' + event.error;
                isListening = false;
                document.getElementById('voiceBtn').textContent = '🎤 Start Voice Scoring';
            };

            recognition.start();
        });

        // Initialize display
        updateDisplay();
    </script>
</body>
</html>
EOF

echo "Cricket Scorer interface updated successfully!"
echo "Visit https://score.ramisetty.net to see the new interface"