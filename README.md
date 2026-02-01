# Thanima Attendance Backend & Dashboard

A comprehensive Next.js application for managing events, registrations, and attendance reporting.

## Features

### Event Management
- **Dashboard**: Centralized view of all events and key statistics.
- **Event Creation**: Easy-to-use interface for setting up new events.
- **Ticket Templates**: **Drag-and-drop editor** to customize ticket layouts (QR code, Name placement, Background image).

### Registration System
- **Manual Entry**: Register individual users with validation.
- **Bulk Import (CSV)**: Upload large lists of attendees. Automatically handles duplicates and validates data (Requires: `name`, `regno`, `email`, `phone`).
- **Secure ID Generation**: Automatically generates a cryptographically secure, consistent hash for every user upon registration.

### Ticket Generation
- **Secure QR Codes**: tickets contain a hash-based QR code that is unique to the user and registration. reproducible and secure.
- **PDF/Image Download**: Generate and download professional tickets based on your custom template.
- **Rate Limiting**: To prevent abuse, ticket downloads are limited to **2 downloads per minute** per user.

### Attendance Tracking
- **Real-time Stats**: View live attendance counts and rates.
- **Verification API**: Secure endpoints for the mobile app to verify tickets without exposing user data.
- **Data Export**: Export attendance reports (future feature).

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT & bcrypt
- **UI**: Tailwind CSS, Shadcn UI
- **State Management**: Tanstack Query
