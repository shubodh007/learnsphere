/**
 * Chat Configuration
 * Toggle features and customize chat behavior
 */

export const chatConfig = {
  // Loading Messages
  loading: {
    // Switch between 'technical' and 'educational' loading messages
    style: 'educational' as 'technical' | 'educational',
    // Rotation speed in milliseconds
    rotationSpeed: 2500,
  },

  // Educational Features
  educational: {
    // Show difficulty badges in responses
    showDifficulty: true,
    // Show time estimates
    showTimeEstimate: true,
    // Enable progress tracking
    enableProgress: true,
    // Show achievement notifications
    showAchievements: true,
  },

  // Message Formatting
  formatting: {
    // Maximum message width
    maxWidth: '85%',
    // Enable markdown rendering for assistant
    enableMarkdown: true,
    // Enable syntax highlighting
    enableSyntaxHighlight: true,
    // Show line numbers in code blocks
    showLineNumbers: false,
  },

  // Suggested Prompts
  suggestedPrompts: {
    enabled: true,
    prompts: [
      'Explain recursion like I\'m 5',
      'What are React hooks?',
      'Help me understand async/await',
      'Compare SQL vs NoSQL databases',
      // Add more educational prompts
      'Show me how to use the map function',
      'Explain object-oriented programming',
      'What are design patterns?',
      'How does the event loop work?',
    ],
  },

  // Response Enhancement
  enhancement: {
    // Automatically detect and add educational markers
    autoDetectDifficulty: true,
    // Suggest related topics at the end of responses
    suggestRelatedTopics: true,
    // Add "Try it yourself" exercises
    generateExercises: false,
  },

  // Performance
  performance: {
    // Enable response streaming
    enableStreaming: true,
    // Debounce input (ms)
    inputDebounce: 0,
    // Max conversation history to send
    maxHistoryMessages: 10,
  },
};

// Helper function to get loading component based on config
export function getLoadingComponent(style: 'technical' | 'educational' = chatConfig.loading.style) {
  if (style === 'educational') {
    return 'EducationalLoadingMessages';
  }
  return 'LoadingMessages';
}

// Helper to parse educational markers from AI response
export function parseEducationalMarkers(content: string) {
  const markers = {
    difficulty: null as string | null,
    timeEstimate: null as number | null,
    hasCallouts: false,
  };

  // Parse [DIFFICULTY:level]
  const difficultyMatch = content.match(/\[DIFFICULTY:(beginner|intermediate|advanced|expert)\]/i);
  if (difficultyMatch) {
    markers.difficulty = difficultyMatch[1].toLowerCase();
    // Remove marker from content
    content = content.replace(difficultyMatch[0], '').trim();
  }

  // Parse [TIME:Xmin]
  const timeMatch = content.match(/\[TIME:(\d+)min\]/i);
  if (timeMatch) {
    markers.timeEstimate = parseInt(timeMatch[1], 10);
    // Remove marker from content
    content = content.replace(timeMatch[0], '').trim();
  }

  // Check for callout markers
  markers.hasCallouts = /\[(TIP|WARNING|CONCEPT|EXERCISE|SUCCESS)\]/i.test(content);

  return {
    markers,
    content,
  };
}

// Helper to convert markers to React components (for future implementation)
export function renderEducationalContent(content: string) {
  // This will be used when we implement marker-based rendering
  // For now, just return processed markdown

  // Example transformations:
  // [TIP]content[/TIP] -> <CalloutBox type="tip">content</CalloutBox>
  // [WARNING]content[/WARNING] -> <CalloutBox type="warning">content</CalloutBox>

  return content;
}
