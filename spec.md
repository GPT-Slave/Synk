# Synk — Product Specification

## Project Name

**Synk**

---

# 1. Overview

Synk is a web application that allows a meeting organizer to create an availability poll by selecting a date range and sharing a unique invitation link.

Participants do **not** need an account. They simply open the invitation link, choose a unique display name, and mark the times they are available.

The organizer can view a live availability heatmap showing the overlap between all participants and choose the optimal meeting time.

---

# 2. Goals

* Eliminate long messaging threads.
* Make scheduling meetings effortless.
* Require authentication only for organizers.
* Allow participants to respond in under one minute.
* Work well on desktop and mobile.
* Have a modern, minimalistic interface.

---

# 3. Target Users

* Student projects
* University clubs
* Startups
* Small businesses
* Friend groups
* Open-source teams

---

# 4. User Roles

## Organizer

Must have an account.

Can:

* Create meetings
* Edit meetings
* Delete meetings
* Share invitation links
* View responses
* Lock meeting
* Select final meeting slot

---

## Participant

No account required.

Can:

* Open invitation link
* Enter display name
* Mark availability
* Edit availability
* Leave comments (optional)

Cannot:

* See other participants' availability
* View organizer dashboard
* Delete meetings

---

# 5. Meeting Creation

Organizer clicks

```
Create Meeting
```

Required fields:

* Meeting title
* Description (optional)
* Start date
* End date
* Working hours
* Time zone
* Response deadline (optional)

Example

```
Title:
INSAT Robotics Weekly Meeting

Start:
12 Aug 2026

End:
15 Aug 2026

Hours:
08:00 → 20:00

Timezone:
Africa/Tunis
```

---

# 6. Invitation Links

Every meeting receives a cryptographically secure identifier.

Example

```
https://platform.com/meets/9eaf7d43c7d84e998ac3154fd7a91d61cf761f4bd6ea70a8d5dfbcdf3cbef861
```

Requirements

* Minimum 256-bit randomness
* Generated using a cryptographically secure random generator
* Impossible to guess through sequential IDs
* URL-safe characters only
* Immutable
* Unique

Never use

```
/meet/15
```

Never use

```
/meet/projectmeeting
```

Always use random identifiers.

---

# 7. Joining a Meeting

Opening the invitation link shows

```
Meeting Title

Description

Date Range

Enter your name

[____________]

Continue
```

No login.

No email.

No password.

---

# 8. Participant Names

Each participant selects a display name.

Rules

* Required
* Between 2 and 30 characters
* Case insensitive uniqueness

Example

Existing

```
Alice
```

Reject

```
alice
ALICE
AlIcE
```

Allow

```
Alice B
Alice-Dev
```

Names are reserved for that meeting.

---

# 9. Availability Selection

Participants see a scheduling grid.

Example

```
        Monday      Tuesday      Wednesday

08:00

09:00

10:00

11:00

12:00

13:00

14:00

15:00

16:00

17:00
```

Users can

* Click
* Drag
* Touch drag (mobile)

Selected cells become highlighted.

Clicking selected cells removes availability.

---

# 10. Calendar Behavior

Selection should feel similar to

* Microsoft Teams
* Google Calendar
* Outlook

Smooth animations.

Instant feedback.

No page reloads.

---

# 11. Organizer Dashboard

Shows

```
Meeting Information

Participants

Responses

Availability Heatmap

Best Meeting Times
```

---

# 12. Availability Heatmap

Each cell shows

```
Available

7 / 10
```

or uses colors

```
Dark Green
100%

Green
80%

Yellow
60%

Orange
40%

Red
20%

Gray
0%
```

Hovering displays

```
Alice

Bob

Charlie

David
```

---

# 13. Best Time Suggestions

System automatically computes

```
Top Matches

1.
Tuesday
14:00–15:00

100%

2.
Wednesday
10:00–11:00

90%

3.
Friday
16:00–17:00

80%
```

Ranked automatically.

---

# 14. Finalizing

Organizer clicks

```
Finalize Meeting
```

Everyone sees

```
Meeting Scheduled

Tuesday

14:00

Confirmed
```

Participants can no longer edit.

---

# 15. Real-Time Updates

Organizer page updates instantly.

No refresh required.

Technology

* WebSockets
* Server-Sent Events

Participant count updates live.

Availability updates live.

---

# 16. Notifications (Future)

* Email invitation
* Reminder
* Meeting finalized

---

# 17. Responsive Design

Desktop

* Full calendar
* Sidebar

Tablet

* Reduced spacing

Phone

* Horizontal scrolling calendar
* Touch optimized

---

# 18. Security

## Organizer Authentication

JWT authentication.

Secure cookies.

---

## Participant

No authentication.

Meeting token required.

---

## Rate Limiting

Prevent spam.

Example

```
30 requests/minute
```

---

## CSRF

Protected.

---

## XSS

Protected.

---

## SQL Injection

Prevented using Prisma.

---

## HTTPS

Required.

---

# 19. Performance

Target

Meeting page loads

< 1 second

Participant update

< 100 ms

Organizer refresh

Real time

Supports

* Thousands of meetings
* Hundreds of simultaneous participants

---

# 20. UI Design Language

Style

Modern

Minimal

Professional

Inspired by

* Linear
* Vercel
* Notion
* Microsoft Fluent 2

Characteristics

* Rounded corners (10–14 px)
* Soft shadows
* Plenty of whitespace
* Glass accents only where appropriate
* Smooth 150–250 ms animations
* Dark mode
* Light mode

Primary accent colors

```
neon red and only dark theme
```

Typography

* Inter
* Geist
* SF Pro (Apple)

Icons

* Lucide

---

# 21. Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion
* TanStack Query

---

## Backend

* NestJS
* Prisma
* PostgreSQL

---

## Real Time

* Socket.IO

---

## Authentication

* JWT
* Refresh Tokens

---

## Deployment

### totally free !!

---

# 22. Database Overview

## User

* id
* email
* password_hash
* created_at

---

## Meeting

* id
* organizer_id
* title
* description
* slug
* timezone
* start_date
* end_date
* workday_start
* workday_end
* finalized
* created_at

---

## Participant

* id
* meeting_id
* display_name
* joined_at

Unique constraint

```
(meeting_id, lower(display_name))
```

---

## Availability

* id
* participant_id
* datetime_start
* datetime_end

# 24. Non-Functional Requirements

* Fast
* Mobile-first
* Accessible (WCAG AA)
* Responsive
* SEO-friendly landing page
* High availability
* Secure by default
* Easy deployment
* Easy maintenance

---

# 25. MVP Scope

Version 1.0 includes:

* Organizer authentication
* Meeting creation
* Secure invitation links
* Participant name entry (no account)
* Drag-to-select availability
* Case-insensitive unique participant names
* Real-time organizer dashboard
* Availability heatmap
* Automatic overlap detection
* Meeting finalization
* Responsive modern UI
* Only Dark mode
