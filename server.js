const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import required packages
const { AlleAIClient } = require("alle-ai-sdk");

// Initialize Alle AI client
const alleai = new AlleAIClient({
  apiKey: process.env.ALLEAI_API_KEY
});

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Enhanced file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir = 'uploads';
    
    if (file.fieldname === 'canvas') uploadDir = 'uploads/canvas';
    else if (file.fieldname === 'avatar') uploadDir = 'uploads/avatars';
    else if (file.fieldname === 'materials') uploadDir = 'uploads/materials';
    else if (file.fieldname === 'audio') uploadDir = 'uploads/voice';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|doc|docx|png|jpg|jpeg|webp|gif|mp3|wav|mp4|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.includes('image') || file.mimetype.includes('audio') || file.mimetype.includes('video');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only documents, images, audio, and video files are allowed'));
    }
  }
});

// Enhanced in-memory storage (replace with MongoDB/Firebase in production)
let users = {};
let conversations = {};
let userFiles = {};
let groupChats = {};
let lecturerAvatars = {};
let userSettings = {};
let notifications = {};
let friendRequests = {};
let storyImages = {};

// 5 Different AI Lecturers with unique personalities
const lecturerTypes = {
  'friendly': {
    id: 'friendly',
    name: 'Professor Friendly',
    description: 'Warm, encouraging, and supportive teaching style',
    personality: 'Very warm and encouraging. Uses lots of positive reinforcement and makes learning feel safe and fun.',
    tone: 'Casual and supportive',
    emoji: '😊',
    color: '#10B981',
    teachingStyle: 'Patient explanation with encouragement',
    responseStyle: 'Simple, positive, lots of examples'
  },
  'academic': {
    id: 'academic',
    name: 'Dr. Academic',
    description: 'Formal, detailed, and comprehensive explanations',
    personality: 'Formal and thorough. Provides detailed, well-structured explanations with proper terminology.',
    tone: 'Professional and comprehensive',
    emoji: '🎓',
    color: '#3B82F6',
    teachingStyle: 'Systematic and detailed approach',
    responseStyle: 'Formal, detailed, uses proper academic terminology'
  },
  'creative': {
    id: 'creative',
    name: 'Prof. Creative',
    description: 'Imaginative, uses stories and analogies',
    personality: 'Highly creative and imaginative. Uses metaphors, stories, and creative analogies to explain concepts.',
    tone: 'Imaginative and engaging',
    emoji: '🎨',
    color: '#8B5CF6',
    teachingStyle: 'Storytelling and creative analogies',
    responseStyle: 'Uses stories, metaphors, and creative examples'
  },
  'practical': {
    id: 'practical',
    name: 'Coach Practical',
    description: 'Focused on real-world applications and examples',
    personality: 'Very practical and application-focused. Emphasizes how things work in the real world.',
    tone: 'Direct and practical',
    emoji: '🔧',
    color: '#F59E0B',
    teachingStyle: 'Real-world examples and applications',
    responseStyle: 'Practical examples, how-to focused, actionable advice'
  },
  'socratic': {
    id: 'socratic',
    name: 'Sage Socratic',
    description: 'Asks questions to guide you to discover answers',
    personality: 'Uses the Socratic method. Guides learning through thoughtful questions rather than direct answers.',
    tone: 'Questioning and thoughtful',
    emoji: '🤔',
    color: '#EF4444',
    teachingStyle: 'Question-based learning and discovery',
    responseStyle: 'Asks guiding questions, encourages thinking, minimal direct answers'
  }
};

// Default user settings
const defaultSettings = {
  theme: 'light',
  fontSize: 'medium',
  customColor: '#3B82F6',
  notifications: true,
  language: 'en',
  autoRead: false,
  voiceSpeed: 'normal'
};

// Helper function to extract text from files
async function extractTextFromFile(filePath, mimetype) {
  try {
    if (mimetype === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    } else if (mimetype === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
      } catch (pdfError) {
        console.log('PDF parsing not available. Install pdf-parse for PDF support.');
        return 'PDF content (install pdf-parse for text extraction)';
      }
    }
    return 'File uploaded successfully (text extraction not supported for this format)';
  } catch (error) {
    console.error('Text extraction error:', error);
    return 'Error extracting text from file';
  }
}

// Routes

// Home & Health
app.get('/', (req, res) => {
  res.json({ 
    message: 'Mentora - Enhanced AI Learning Platform',
    status: 'operational',
    features: ['google_auth', 'ai_lecturers', 'image_generation', 'voice_synthesis', 'group_management'],
    version: '4.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    alleai: process.env.ALLEAI_API_KEY ? 'connected' : 'missing_key',
    features_active: ['chat', 'upload', 'groups', 'voice', 'lecturers', 'notifications']
  });
});

// User Management & Google Auth
app.post('/api/auth/google', (req, res) => {
  try {
    const { googleToken, userInfo } = req.body;
    
    // In production, verify Google token here
    const userId = userInfo.email;
    
    // Create or update user
    users[userId] = {
      id: userId,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      createdAt: users[userId]?.createdAt || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      settings: users[userId]?.settings || defaultSettings
    };

    // Initialize user data
    if (!conversations[userId]) conversations[userId] = {};
    if (!userFiles[userId]) userFiles[userId] = '';
    if (!userSettings[userId]) userSettings[userId] = defaultSettings;
    if (!notifications[userId]) notifications[userId] = [];

    res.json({
      success: true,
      user: users[userId],
      token: 'demo_token_' + userId // In production, generate proper JWT
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
});

// Get user by search
app.get('/api/users/search', (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ success: true, users: [] });
    }

    const searchResults = Object.values(users).filter(user => 
      user.name.toLowerCase().includes(query.toLowerCase()) ||
      user.email.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10); // Limit to 10 results

    res.json({
      success: true,
      users: searchResults.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture
      }))
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ 
      error: 'Failed to search users',
      details: error.message 
    });
  }
});

// Enhanced Chat with Lecturer Selection
app.post('/api/chat/lecturer', async (req, res) => {
  try {
    const { message, userId, lecturerType = 'friendly', chatId = 'main' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const lecturer = lecturerTypes[lecturerType];
    if (!lecturer) {
      return res.status(400).json({ error: 'Invalid lecturer type' });
    }

    // Initialize user data
    if (!conversations[userId]) conversations[userId] = {};
    if (!conversations[userId][chatId]) conversations[userId][chatId] = [];

    // Get file context
    const fileContext = userFiles[userId] ? 
      `\n\nStudent's uploaded materials: ${userFiles[userId].slice(0, 1500)}...` : '';

    const systemPrompt = `You are ${lecturer.name}, an AI lecturer with this personality: ${lecturer.personality}

Teaching Style: ${lecturer.teachingStyle}
Response Style: ${lecturer.responseStyle}
Tone: ${lecturer.tone}

IMPORTANT INSTRUCTIONS:
- Always respond exactly as ${lecturer.name} would
- Match the specified response style and tone perfectly
- If the lecturer type is 'socratic', ask guiding questions instead of giving direct answers
- If the lecturer type is 'creative', use stories and metaphors
- If the lecturer type is 'practical', focus on real-world applications
- If the lecturer type is 'academic', be formal and comprehensive
- If the lecturer type is 'friendly', be encouraging and supportive

Context from student's files: ${fileContext}`;

    try {
      const response = await alleai.chat.completions({
        models: ['gpt-4o'],
        messages: [
          {
            system: [{ type: "text", text: systemPrompt }],
            user: [{ type: "text", text: message }]
          }
        ],
        web_search: false,
        temperature: lecturerType === 'creative' ? 0.9 : 0.7,
        max_tokens: 1000,
        stream: false
      });

      let aiAnswer = `As ${lecturer.name}, I'd say: "I'm having some technical difficulties right now, but let me try to help you with that topic!"`;
      
      if (response.success && response.responses && response.responses.responses) {
        const modelResponses = response.responses.responses;
        const firstModelKey = Object.keys(modelResponses)[0];
        
        if (firstModelKey && modelResponses[firstModelKey] && modelResponses[firstModelKey].message) {
          aiAnswer = modelResponses[firstModelKey].message.content || aiAnswer;
        }
      }

      // Store conversation
      conversations[userId][chatId].push(
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: aiAnswer, lecturer: lecturerType, timestamp: new Date().toISOString() }
      );

      // Keep last 20 messages
      if (conversations[userId][chatId].length > 20) {
        conversations[userId][chatId] = conversations[userId][chatId].slice(-20);
      }

      res.json({
        success: true,
        response: aiAnswer,
        lecturer: lecturer,
        timestamp: new Date().toISOString()
      });

    } catch (alleError) {
      // Fallback response matching lecturer personality
      const fallbackResponses = {
        friendly: "That's such a great question! I love your curiosity. Let me help you with that topic - it's really fascinating!",
        academic: "This is an excellent inquiry that requires a systematic approach. Allow me to provide a comprehensive explanation.",
        creative: "What an intriguing topic! Let me paint you a picture with a story that will make this concept come alive...",
        practical: "Great question! Let me show you exactly how this works in the real world and why it matters.",
        socratic: "That's an interesting topic. What do you already know about this? What connections can you make?"
      };
      
      const fallbackResponse = fallbackResponses[lecturerType] + ` You asked about: "${message}". (Note: Using fallback mode)`;

      res.json({
        success: true,
        response: fallbackResponse,
        lecturer: lecturer,
        mode: 'fallback',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Lecturer chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error.message 
    });
  }
});

// Get available lecturers
app.get('/api/lecturers/types', (req, res) => {
  res.json({
    success: true,
    lecturers: Object.values(lecturerTypes)
  });
});

// Enhanced Storytelling with Image Generation
app.post('/api/storytelling/enhanced', async (req, res) => {
  try {
    const { concept, mode = 'story', userId, generateImages = true, generateAudio = true } = req.body;

    if (!concept) {
      return res.status(400).json({ error: 'Concept is required' });
    }

    let storyPrompt;
    switch (mode) {
      case 'story':
        storyPrompt = `Create an engaging, educational story that explains "${concept}". Make it visual and descriptive so it could be illustrated. Include specific scenes that could be turned into images.`;
        break;
      case 'metaphor':
        storyPrompt = `Explain "${concept}" using a detailed visual metaphor. Describe the metaphor in a way that could be illustrated with images.`;
        break;
      case 'dialogue':
        storyPrompt = `Create a dialogue between characters discussing "${concept}". Include scene descriptions that could be illustrated.`;
        break;
      case 'interactive':
        storyPrompt = `Create an interactive explanation of "${concept}" with step-by-step visual elements that could be illustrated.`;
        break;
      default:
        storyPrompt = `Explain "${concept}" in an engaging, visual way with descriptive scenes.`;
    }

    try {
      // Generate story
      const storyResponse = await alleai.chat.completions({
        models: ['gpt-4o'],
        messages: [
          {
            user: [{ type: "text", text: storyPrompt }]
          }
        ],
        temperature: 0.8,
        max_tokens: 1200,
        stream: false
      });

      let storyContent = 'Unable to generate story at this time.';
      
      if (storyResponse.success && storyResponse.responses && storyResponse.responses.responses) {
        const modelResponses = storyResponse.responses.responses;
        const firstModelKey = Object.keys(modelResponses)[0];
        
        if (firstModelKey && modelResponses[firstModelKey] && modelResponses[firstModelKey].message) {
          storyContent = modelResponses[firstModelKey].message.content || storyContent;
        }
      }

      let images = [];
      let audioUrl = null;

      // Generate images if requested
      if (generateImages && storyContent !== 'Unable to generate story at this time.') {
        try {
          // Create image prompts from story
          const imagePrompts = [
            `Illustration for educational story about ${concept}, colorful and engaging, suitable for learning`,
            `Visual representation of ${concept}, educational illustration style, clear and informative`,
            `Scene from story about ${concept}, cartoon style, educational and friendly`
          ];

          // In a real implementation, you would use an image generation API here
          // For now, we'll simulate image URLs
          images = imagePrompts.map((prompt, index) => ({
            id: `img_${Date.now()}_${index}`,
            prompt: prompt,
            url: `/api/placeholder-image/${encodeURIComponent(concept)}_${index}`,
            generated: true
          }));

          storyImages[`${userId}_${concept}`] = images;
        } catch (imageError) {
          console.error('Image generation error:', imageError);
        }
      }

      // Generate audio if requested (placeholder for TTS)
      if (generateAudio) {
        audioUrl = `/api/placeholder-audio/${encodeURIComponent(concept)}`;
      }

      res.json({
        success: true,
        story: storyContent,
        concept: concept,
        mode: mode,
        images: images,
        audioUrl: audioUrl,
        timestamp: new Date().toISOString()
      });

    } catch (alleError) {
      const fallbackStory = `Here's a simple explanation of ${concept}: This is an important concept that involves multiple interconnected elements. To better understand it, think of it as a system where different components work together to achieve a specific outcome. (Fallback mode - please check API credits for enhanced storytelling)`;
      
      res.json({
        success: true,
        story: fallbackStory,
        concept: concept,
        mode: 'fallback',
        images: [],
        audioUrl: null,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Enhanced storytelling error:', error);
    res.status(500).json({ 
      error: 'Failed to generate enhanced story',
      details: error.message 
    });
  }
});

// Placeholder image endpoint
app.get('/api/placeholder-image/:concept_index', (req, res) => {
  const { concept_index } = req.params;
  // In production, this would return actual generated images
  // For now, return a placeholder SVG
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#3B82F6"/>
      <text x="200" y="150" text-anchor="middle" fill="white" font-size="16" font-family="Arial">
        Generated Image: ${decodeURIComponent(concept_index)}
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Placeholder audio endpoint
app.get('/api/placeholder-audio/:concept', (req, res) => {
  const { concept } = req.params;
  // In production, this would return actual TTS audio
  res.json({
    success: true,
    message: `Audio for ${decodeURIComponent(concept)} would be generated here`,
    placeholder: true
  });
});

// Group Management with User Search and Invites
app.post('/api/groups/invite', (req, res) => {
  try {
    const { groupId, invitedUserId, inviterUserId } = req.body;
    
    if (!groupChats[groupId]) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!users[invitedUserId]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create notification for invited user
    if (!notifications[invitedUserId]) notifications[invitedUserId] = [];
    
    const notification = {
      id: uuidv4(),
      type: 'group_invite',
      title: 'Group Invitation',
      message: `${users[inviterUserId]?.name || 'Someone'} invited you to join "${groupChats[groupId].name}"`,
      data: {
        groupId: groupId,
        inviterUserId: inviterUserId,
        groupName: groupChats[groupId].name
      },
      timestamp: new Date().toISOString(),
      read: false
    };

    notifications[invitedUserId].push(notification);

    res.json({
      success: true,
      notification: notification
    });

  } catch (error) {
    console.error('Group invite error:', error);
    res.status(500).json({ 
      error: 'Failed to send group invite',
      details: error.message 
    });
  }
});

// Accept group invitation
app.post('/api/groups/accept-invite', (req, res) => {
  try {
    const { notificationId, userId } = req.body;
    
    const userNotifications = notifications[userId] || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (!notification || notification.type !== 'group_invite') {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const groupId = notification.data.groupId;
    const group = groupChats[groupId];
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Add user to group
    if (!group.members.includes(userId)) {
      group.members.push(userId);
    }

    // Mark notification as read
    notification.read = true;

    res.json({
      success: true,
      group: group
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ 
      error: 'Failed to accept invitation',
      details: error.message 
    });
  }
});

// Get user notifications
app.get('/api/notifications/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const userNotifications = notifications[userId] || [];
    
    res.json({
      success: true,
      notifications: userNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      error: 'Failed to get notifications',
      details: error.message 
    });
  }
});

// Mark notification as read
app.post('/api/notifications/:notificationId/read', (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    
    const userNotifications = notifications[userId] || [];
    const notification = userNotifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
    }

    res.json({
      success: true,
      notification: notification
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      details: error.message 
    });
  }
});

// Enhanced User Settings
app.post('/api/settings/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const settings = req.body;

    userSettings[userId] = {
      ...userSettings[userId],
      ...settings,
      updatedAt: new Date().toISOString()
    };

    // Update user settings in users object too
    if (users[userId]) {
      users[userId].settings = userSettings[userId];
    }

    res.json({
      success: true,
      settings: userSettings[userId]
    });

  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ 
      error: 'Failed to update settings',
      details: error.message 
    });
  }
});

app.get('/api/settings/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const settings = userSettings[userId] || defaultSettings;

    res.json({
      success: true,
      settings: settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ 
      error: 'Failed to get settings',
      details: error.message 
    });
  }
});

// Enhanced File Upload with better context access
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId } = req.body;
    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;

    // Extract text content
    const extractedText = await extractTextFromFile(filePath, req.file.mimetype);
    
    // Store for this user with better organization
    if (!userFiles[userId]) userFiles[userId] = '';
    userFiles[userId] += `\n\n=== FILE: ${originalName} ===\n${extractedText}`;

    const fileInfo = {
      id: fileName,
      originalName: originalName,
      size: req.file.size,
      type: req.file.mimetype,
      url: `/uploads/materials/${fileName}`,
      uploadedAt: new Date().toISOString(),
      textExtracted: !!extractedText,
      preview: extractedText.slice(0, 300) + (extractedText.length > 300 ? '...' : ''),
      userId: userId
    };

    res.json({
      success: true,
      message: 'File uploaded and processed successfully',
      file: fileInfo
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mentora Enhanced Platform running on port ${PORT}`);
  console.log(`📝 Open browser to: http://localhost:${PORT}`);
  console.log(`🤖 Alle AI Status: ${process.env.ALLEAI_API_KEY ? 'Connected' : 'API Key Required'}`);
  console.log(`👥 Features: Google Auth, 5 AI Lecturers, Image Generation, User Search, Notifications`);
  console.log(`🎨 Lecturers: ${Object.keys(lecturerTypes).join(', ')}`);
});

module.exports = app;