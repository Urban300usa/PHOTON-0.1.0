# PHOTON

## Overview

PHOTON is a web application designed for EVE Online players to efficiently track and optimize their in-game ISK income from activities like ratting and mining. It offers real-time session tracking, comprehensive income management, historical data analysis, and seamless integration with the EVE ESI API for automated data synchronization and authentication. The project aims to deliver a powerful and immersive platform to enhance players' ability to monitor their earnings, with plans for PRO subscription features and active community engagement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript.
- **UI**: Shadcn/ui (Radix UI-based) for accessible components with a dark gaming aesthetic.
- **Styling**: Tailwind CSS with custom variables, supporting EVE-themed racial color palettes.
- **Theming**: A 14-theme system (6 free, 8 PRO) with EVE Online faction colors, persisted via localStorage.
- **State Management**: React hooks and TanStack Query.
- **Routing**: Wouter.
- **Typography**: Inter, JetBrains Mono.
- **Responsive Design**: Mobile-first using Tailwind breakpoints.

### Backend
- **Framework**: Express.js on Node.js with TypeScript.
- **Session Management**: Express-session with HTTP-only cookies.
- **Authentication**: EVE Online ESI OAuth 2.0.
- **API**: RESTful endpoints under `/api`.
- **Development**: Vite dev server for HMR.
- **Build**: esbuild (server), Vite (client).

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM.
- **Tables**: Includes `proSubscriptions`, `userPreferences`, `processedTransactions`, `incomeGoals`, `userMoons`, `industryJobs`, `planetaryPlanets`, `planetaryPins`, and others for managing user and game-related data.
- **Migrations**: Drizzle Kit.
- **Abstraction**: `IStorage` interface for flexible storage implementations.

### Key Architectural Decisions
- **Monorepo**: Consolidates client, server, and shared code.
- **Type Safety**: Zod schemas for client-server data validation.
- **Progressive Enhancement**: Core functionality available without ESI, enhanced with ESI integration.
- **Admin System**: Role-based access for subscription, user, and system management.
- **PRO Subscription System**: ISK-based in-game payments for premium features, themes, and badges.
- **Multi-Character Support**: Allows linking multiple EVE characters with an aggregate view mode and character-specific data.
- **ESI Caching System**: 5-minute TTL caching for ESI lookups to prevent API throttling.
- **Feature Specifications**:
    - **Loot Tracker**: Real-time Jita market prices for ratting loot.
    - **Mining Tracker**: Displays ESI mining ledger data, ore valuation, and history.
    - **Industry Job Tracker**: Tracks manufacturing, invention, research, and reaction jobs with profit calculations, inspired by EVE Guru and EVE Cookbook.
    - **Planetary Industry Tracker**: Monitors PI colonies, extractor status, production chains, and ISK valuation, including an Adam4EVE-style PI Calculator.
    - **Assets Tracker**: Views character assets, locations, and net worth calculations.
    - **Contracts Tracker**: Displays character contracts with filtering, status, and ISK value details.
    - **Metenox Moon Calculator**: Admin tool for calculating moon mining ISK/month values based on EVE probe scan data and Jita prices.
    - **Dashboard Tile System**: Customizable and draggable tiles for displaying information.
    - **Income Goals System**: PRO feature for setting and tracking ISK earning targets.
    - **Admin Audit Logging**: Records all admin actions with filtering capabilities.
    - **Admin Panel**: Streamlined 7-tab interface for administration (Dashboard, Subscriptions, Users, Support, Logs, Tools, Changelog).
    - **Support Ticket Editing**: Users and admins can edit ticket messages.
    - **Automated Changelog System**: Database-driven changelog management with admin UI for creating, editing, and publishing release notes. Features include version management, change type categorization (feature, improvement, fix, etc.), icon support, PRO-only and admin-only entry flags. The WhatsNewDialog fetches changelogs from the database API and auto-shows for unseen versions.

## External Dependencies

- **EVE Online ESI API**: Authentication, token verification, wallet journals, market data, asset information, industry jobs, planetary data, and contracts.
- **shadcn/ui**: UI component library.
- **Radix UI**: Unstyled component primitives.
- **date-fns**: Date manipulation.
- **PostgreSQL**: Production database.