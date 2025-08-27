# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 project showcasing a mountain climbing progress visualization called "Climb You". The application features an animated SVG-based mountain scene with a hiker that moves along a trail path to represent quest/progress completion.

## Development Commands

- `npm run dev` - Start development server with Turbopack (opens http://localhost:3000)
- `npm run build` - Build production application with Turbopack
- `npm start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Architecture

### Component Structure
- **App Router**: Uses Next.js App Router pattern (`app/` directory)
- **Main Demo**: `ClimbYouMountainDemo` component handles the complete mountain visualization
- **Layout**: Standard Next.js layout with Geist fonts and global CSS

### Key Libraries
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React version
- **Framer Motion**: Animation library for SVG path animations and component transitions
- **Tailwind CSS v4**: Utility-first CSS framework with PostCSS integration
- **TypeScript**: Full TypeScript setup with strict configuration

### Animation System
The core component (`ClimbYouMountainDemo.tsx`) implements:
- **SVG Path Animation**: Uses Framer Motion to animate a hiker along an SVG trail
- **Progress Control**: Supports both controlled (external progress prop) and uncontrolled (internal buttons) modes
- **Parallax Effects**: Multiple mountain layers with different scroll speeds
- **Accessibility**: Respects `prefers-reduced-motion` setting
- **Checkpoints**: Configurable progress milestones with visual feedback

### Path Alias Configuration
- `@/*` maps to project root directory for clean imports

## File Organization

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `public/` - Static assets (includes SVG icons, expects `hiker.png` for character)
- Root config files for TypeScript, ESLint, PostCSS, and Next.js

## Development Notes

- Uses Turbopack for faster development builds
- ESLint configured with Next.js recommended rules and TypeScript support
- Component expects a `hiker.png` image in the public directory for the animated character
- Japanese comments in the main component indicate internationalization considerations