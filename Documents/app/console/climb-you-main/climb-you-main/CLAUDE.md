# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
```bash
npm install       # Install dependencies
npm start         # Start Expo development server
npm run android   # Start on Android emulator/device
npm run ios       # Start on iOS simulator/device
npm run web       # Start web development server
```

### Project Management
- Use `expo start` as the primary development command
- The app uses Expo CLI and React Native with the new architecture enabled
- TypeScript is configured with strict mode enabled

## Architecture Overview

### Core Structure
This is a React Native Expo application with a bottom tab navigation structure focused on task management and mountain climbing visualization:

**Navigation Architecture:**
- `App.tsx` - Root component that renders `AppNavigator` and `StatusBar`
- `src/navigation/AppNavigator.tsx` - Bottom tab navigator with 5 tabs: Main, Tasks (Progress), AddTask (floating action button), Profile, and Settings
- Navigation uses React Navigation v7 with TypeScript support
- Custom tab icons using both image assets and custom SVG-style components

**Screen Architecture:**
- `MainScreen` - Combined task management and mountain visualization (primary screen)
- `TasksScreen` - Dedicated task management with CRUD operations
- `AddTaskScreen` - Task creation interface
- `MountainScreen` - Dedicated progress visualization screen
- Profile and Settings tabs currently route to `TasksScreen` (placeholder implementation)

**Component Architecture:**
- `MountainAnimation` - Complex animated component using `Animated.Value` and `LinearGradient`
- Uses React Native's built-in animation system with interpolation for climbing progress
- Responsive design based on screen dimensions with custom color gradients
- Task management uses local state with real-time progress calculation

### State Management
- **Local State Only**: Uses React's `useState` and `useEffect` hooks
- No external state management (Redux, Zustand, etc.)
- Task data is managed locally in `MainScreen` component with predefined dummy tasks
- Progress calculation is automatic based on completed/total tasks ratio
- Real-time progress updates trigger mountain animation changes
- State is not persisted between app sessions (in-memory only)

### Key Dependencies
- **Navigation**: `@react-navigation/native` + `@react-navigation/bottom-tabs`
- **UI**: Native React Native components + `expo-linear-gradient`
- **Graphics**: `react-native-svg` for vector graphics
- **Platform**: Expo SDK ~53.0

### Data Models
Core TypeScript interfaces in `src/types/index.ts`:
- `Task` - Task management with completion tracking
- `User` - User progression with level and progress
- `RootStackParamList` - Navigation type safety

### Animation System
`MountainAnimation` component features:
- Progress-based climber position animation using `Animated.Value`
- Interpolated positioning for realistic climbing path
- Visual progress indicators with path dots
- Success state with flag animation at 100% completion

### Styling Patterns
- Uses `StyleSheet.create()` consistently
- **Color Scheme**: 
  - Primary: Night Sky blue (#1a486c, #406383) for backgrounds
  - Mountain: Deep blues (#103c61, #1c4c70) for mountain gradients  
  - Sun: Warm gradient (#1c4c70 to #fcb6a0) for sunrise effect
  - Accent: Primary blue (#007AFF) for interactive elements
  - Success: Green (#4CAF50) for completed states
- Shadow/elevation patterns for card-like components with consistent opacity and radius
- Responsive sizing using `Dimensions.get('window')` for screen-based layouts
- Card-based UI with rounded corners (12-20px radius)
- Japanese color palette inspired by mountain landscapes

## Development Guidelines

### File Organization
- Screens go in `src/screens/` (MainScreen, TasksScreen, AddTaskScreen, MountainScreen)
- Reusable components in `src/components/` (currently MountainAnimation)
- Navigation config in `src/navigation/` (AppNavigator)
- Type definitions in `src/types/` (Task, User, RootStackParamList)
- Assets in `assets/` (icons: home-icon.png, mountain-flag-icon.png, settings-icon.png)
- Project documentation in `project-docs/`

### Naming Conventions
- Components use PascalCase (e.g., `TasksScreen`, `MountainAnimation`)
- Files match component names
- Interfaces use PascalCase with descriptive names

### TypeScript Usage
- Strict mode enabled in `tsconfig.json`
- Interface definitions for all data structures
- Navigation params properly typed with `RootStackParamList`
- Component props interfaces defined inline or separately

### Animation Patterns
- Use `useRef` with `Animated.Value` for smooth animations
- Implement proper cleanup in `useEffect` for animations
- Use `interpolate` for complex value transformations (mountain climber positioning)
- Leverage `useNativeDriver: true` when possible for performance
- Progress-driven animations that respond to state changes
- Mountain climbing metaphor with realistic path interpolation

### Key Implementation Details
- **Layout Structure**: MainScreen uses 1/3 screen for mountain, 2/3 for tasks
- **Task Grid**: 2-column FlatList with dummy items for even layout
- **Progress Calculation**: Real-time based on completed/total tasks ratio
- **Touch Interactions**: Tap to toggle completion, long-press to delete
- **UI Polish**: Custom floating action button with plus icon
- **Responsive Design**: Screen height-based layout calculations
- **Japanese Localization**: Task titles and UI text in Japanese

## Onboarding System

### Current Implementation (v1.0)
The app features a comprehensive 3-step onboarding flow with unified NightSky/Moonlight design:

**Onboarding Flow:**
1. **Goal Input Screen** - Goal setting, time period, intensity selection
2. **Profile Questions Screen** - Dynamic questionnaire (currently 12 static questions)
3. **Quest Preferences Screen** - Quest rating with Trail Segmented UI (hiker slider)

**UI Design System:**
- **Color Scheme**: NightSky (#0F2A44), DeepPine (#1E3A4B), Moonlight (#F3E7C9), Mist (#B9C3CF)
- **Trail Segmented UI**: 3-point slider with hiker icon for quest preferences
- **Unified Styling**: All screens (onboarding + main app) use consistent color palette
- **Typography**: Moonlight text on NightSky backgrounds with proper contrast ratios
- **Interactive Elements**: Moonlight glow effects with NightSky text for accessibility

**Data Flow:**
- TypeScript interfaces for type-safe navigation parameter passing
- AsyncStorage persistence for onboarding completion status
- Data collection: goal data → profile responses → quest preferences

### Planned Enhancement: Firebase + AI Integration (v2.0)

**Architecture Overview:**
```
React Native App → Firebase Functions → AI Service (OpenAI) → Firestore Database
     ↓                    ↓                    ↓                    ↓
User Interactions → Question Generation → Quest Generation → Data Persistence
```

**Firebase Services Integration:**
- **🔥 Firestore Database**: User profiles, questions, responses, quests, preferences
- **🔥 Firebase Functions**: AI integration layer for dynamic content generation  
- **🔥 Firebase Auth**: Anonymous authentication for user tracking
- **🔥 Firebase Analytics**: User behavior analysis for continuous improvement

**Data Model (Firestore Collections):**
```
users/{userId}
├── goals/{goalId}              // User's learning objectives
├── profileQuestions/{qId}      // AI-generated profile questions
├── profileResponses/{rId}      // User's answers to questions
├── quests/{questId}           // AI-generated quests/tasks
├── questPreferences/{pId}     // User's quest ratings (love/like/dislike)
└── profile (document)         // Aggregated user profile for AI personalization
```

**AI-Powered Features:**
1. **Dynamic Question Generation**: Personalized profiling questions based on user's goals
2. **Personalized Quest Creation**: Custom quests generated from user profile analysis
3. **Continuous Learning**: Quest preferences feed back into future generation
4. **Similarity Matching**: Learn from similar user patterns for better recommendations

**Implementation Phases:**
- **Phase 1 (2-3 weeks)**: Firebase setup, basic Functions, anonymous auth
- **Phase 2 (2-3 weeks)**: AI integration, dynamic question/quest generation
- **Phase 3 (2-4 weeks)**: Advanced personalization, user profile analysis, optimization

**Technical Stack:**
- Frontend: `@react-native-firebase/*` packages for seamless integration
- Backend: Firebase Functions with OpenAI API integration
- Database: Firestore with security rules for user data protection
- AI Service: OpenAI GPT-4 for high-quality Japanese content generation

**Privacy & Security:**
- Anonymous authentication (device-based identification)
- User data siloed per account with Firestore security rules
- No personal information storage (device ID only)
- Configurable data retention policies

**Expected Benefits:**
- Personalized user experience from day one
- Scalable content generation without manual curation  
- Data-driven insights for product improvement
- Reduced development/maintenance overhead with Firebase managed services