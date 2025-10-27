# Implementation Plan

- [x] 1. Initialize Next.js project with TypeScript and core dependencies
  - Create Next.js 14 app with App Router and TypeScript
  - Install and configure Tailwind CSS with custom design system
  - Set up project structure (components, lib, types directories)
  - Configure environment variables for Pusher, MongoDB, UploadThing
  - _Requirements: 14.1, 14.2, 14.3_

- [x] 2. Set up database and data models
  - [x] 2.1 Configure MongoDB connection with Mongoose
    - Create database connection utility with connection pooling
    - Set up MongoDB client for serverless environment
    - _Requirements: 5.4_
  
  - [x] 2.2 Create Message schema and model
    - Define Message schema with all fields (content, userName, userCountry, timestamp, attachments, replyTo, reactions, edited)
    - Add indexes for efficient querying (timestamp descending)
    - Create TypeScript interfaces matching schema
    - _Requirements: 5.4, 3.4, 4.2, 6.5, 6.6, 7.3, 8.3, 10.4, 11.3_

- [x] 3. Implement design system and theme provider
  - [x] 3.1 Create Tailwind configuration with design tokens
    - Define color palette for dark and light themes
    - Set up typography scale and font families
    - Configure spacing system (4px grid)
    - Add border radius and animation utilities
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [x] 3.2 Build ThemeProvider component
    - Create React context for theme state
    - Implement theme toggle function
    - Add localStorage persistence for theme preference
    - Detect and apply system theme preference as default
    - Apply theme classes to document root
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 4. Create API route for country detection
  - Implement GET /api/country endpoint
  - Extract IP address from request headers
  - Integrate IP geolocation API (ip-api.com or similar)
  - Return country code and flag emoji
  - Add caching to minimize API calls
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Build message API routes
  - [x] 5.1 Implement POST /api/messages endpoint
    - Validate message content (max 5000 chars)
    - Get user country from IP
    - Save message to MongoDB
    - Initialize Pusher and trigger 'new-message' event on 'chat-room' channel
    - Return created message with all metadata
    - _Requirements: 5.1, 5.2, 5.4, 5.5_
  
  - [x] 5.2 Implement GET /api/messages endpoint
    - Query messages from MongoDB sorted by timestamp descending
    - Support pagination with limit and before parameters
    - Populate replyTo references
    - Return messages array and hasMore flag
    - _Requirements: 5.5_
  
  - [x] 5.3 Implement PATCH /api/messages/[id] endpoint
    - Verify message exists and is less than 10 minutes old
    - Verify userName matches original sender
    - Update message content in MongoDB
    - Set edited flag and editedAt timestamp
    - Trigger Pusher 'update-message' event
    - _Requirements: 10.3, 10.4, 10.5_
  
  - [x] 5.4 Implement DELETE /api/messages/[id] endpoint
    - Verify message exists and is less than 10 minutes old
    - Verify userName matches original sender
    - Delete message from MongoDB
    - Trigger Pusher 'delete-message' event
    - _Requirements: 11.3, 11.4, 11.5_

- [x] 6. Build reactions API route
  - Implement POST /api/reactions endpoint
  - Find message by ID in MongoDB
  - Add or remove reaction based on action parameter
  - Update reactions array (add if not exists, remove if exists)
  - Trigger Pusher 'new-reaction' event with updated reactions
  - Return updated reactions array
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 9.3, 9.4_

- [x] 7. Implement file upload integration
  - [x] 7.1 Set up UploadThing configuration
    - Create uploadthing core configuration file
    - Define file upload endpoints for images and documents
    - Set size limits (10MB for images, 25MB for documents)
    - Configure allowed file types (JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX, TXT)
    - _Requirements: 6.2, 6.3, 6.4_
  
  - [x] 7.2 Create upload API route
    - Implement POST /api/uploadthing route handler
    - Connect to UploadThing service
    - Return uploaded file URL and metadata
    - _Requirements: 6.2_

- [x] 8. Build NameModal component
  - Create modal UI with input field for name entry
  - Implement name validation (1-30 alphanumeric characters)
  - Show modal on first visit when no name in localStorage
  - Allow name changes via settings button
  - Save name to localStorage on submit
  - Provide onSubmit callback with validated name
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [x] 9. Create MessageInput component
  - [x] 9.1 Build text input with auto-resize
    - Create textarea that grows with content
    - Add character counter (max 5000)
    - Handle Enter to send, Shift+Enter for newline
    - Style with design system tokens
    - _Requirements: 5.1_
  
  - [x] 9.2 Add file attachment functionality
    - Create file input button with icon
    - Handle file selection and validation
    - Show file preview for images
    - Display file name and size for documents
    - Upload files to UploadThing on selection
    - Show upload progress indicator
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 9.3 Implement reply context display
    - Show reply preview above input when replying
    - Display parent message snippet and author
    - Add cancel button to clear reply context
    - Pass replyTo ID with message submission
    - _Requirements: 7.2, 7.3_
  
  - [x] 9.4 Wire up message sending
    - Call POST /api/messages on submit
    - Include content, attachments, and replyTo
    - Clear input and attachments after successful send
    - Show error message on failure
    - _Requirements: 5.2, 5.3_

- [x] 10. Build EmojiPicker component
  - [x] 10.1 Create quick reactions UI
    - Display 5 emoji buttons (👍, ❤️, 😂, 😮, 😢)
    - Style as horizontal row with hover effects
    - Handle emoji selection and call onSelect callback
    - _Requirements: 8.1, 8.2_
  
  - [x] 10.2 Build extended emoji palette
    - Create grid layout with 50 diverse emojis
    - Organize into categories (smileys, gestures, objects, symbols)
    - Add category tabs for navigation
    - Implement search/filter functionality
    - Show palette in popover or modal
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 11. Create MessageActions component
  - Display action buttons on message hover (desktop) or long-press (mobile)
  - Show reply, react, edit, delete buttons based on context
  - Only show edit/delete for own messages less than 10 minutes old
  - Calculate time remaining for edit/delete eligibility
  - Position actions menu near message (floating or inline)
  - Handle action button clicks and call appropriate callbacks
  - _Requirements: 7.1, 8.1, 10.1, 10.5, 11.1, 11.5_

- [x] 12. Build MessageItem component
  - [x] 12.1 Create message layout and metadata display
    - Display user name with country flag emoji
    - Show timestamp in UTC format (HH:MM:SS UTC or MMM DD, HH:MM UTC)
    - Add "edited" indicator for edited messages
    - Style own messages differently from others
    - Apply design system styling (rounded corners, padding, colors)
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 10.4, 15.5_
  
  - [x] 12.2 Implement message content rendering
    - Render text content with proper line breaks
    - Detect and convert URLs to clickable links
    - Display inline images for image attachments
    - Show download links for file attachments with name and size
    - _Requirements: 5.3, 6.5, 6.6_
  
  - [x] 12.3 Add reply context display
    - Show parent message preview when message is a reply
    - Display parent author and content snippet
    - Make reply preview clickable to scroll to parent
    - Style reply connection with visual indicator (line or indent)
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [x] 12.4 Implement reactions display
    - Show reaction emojis with counts below message
    - Group same emojis and display count
    - Highlight reactions from current user
    - Make reactions clickable to add/remove
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 12.5 Integrate MessageActions component
    - Render MessageActions with appropriate callbacks
    - Pass message ownership and timestamp info
    - Handle edit mode (show input to edit content)
    - Handle delete confirmation dialog
    - _Requirements: 10.1, 10.2, 10.3, 11.1, 11.2_

- [x] 13. Create MessageList component
  - [x] 13.1 Build scrollable message feed
    - Implement virtual scrolling with react-window for performance
    - Render MessageItem components for each message
    - Auto-scroll to bottom when new messages arrive
    - Show loading indicator while fetching messages
    - _Requirements: 5.5, 14.4_
  
  - [x] 13.2 Add scroll-to-parent functionality
    - Implement scrollToMessage function that accepts message ID
    - Scroll to and highlight target message when reply is clicked
    - Add smooth scroll animation
    - _Requirements: 7.5_
  
  - [x] 13.3 Implement pagination
    - Detect when user scrolls near top
    - Load older messages using GET /api/messages with before parameter
    - Prepend older messages to list
    - Maintain scroll position after loading
    - _Requirements: 5.5_

- [x] 14. Build main ChatRoom page component
  - [x] 14.1 Set up Pusher client connection
    - Initialize Pusher with public key and cluster from env vars
    - Subscribe to 'chat-room' channel
    - Handle connection states (connecting, connected, disconnected, error)
    - Show connection status indicator in UI
    - _Requirements: 5.5_
  
  - [x] 14.2 Implement real-time event listeners
    - Bind 'new-message' event to add messages to state
    - Bind 'update-message' event to update message content
    - Bind 'delete-message' event to remove messages from state
    - Bind 'new-reaction' event to update message reactions
    - _Requirements: 5.5, 8.5, 10.3, 11.4_
  
  - [x] 14.3 Manage user session state
    - Check localStorage for existing userName
    - Show NameModal if no userName exists
    - Get user country on mount using /api/country
    - Store userName and country in component state
    - Provide name change functionality
    - _Requirements: 1.4, 1.5, 2.4, 4.1_
  
  - [x] 14.4 Coordinate message operations
    - Load initial messages on mount using GET /api/messages
    - Handle message sending via MessageInput
    - Handle message editing and deletion
    - Handle reactions via MessageItem
    - Handle replies via MessageItem and MessageInput
    - _Requirements: 5.2, 5.5, 7.2, 8.2, 10.3, 11.3_
  
  - [x] 14.5 Compose page layout
    - Render ThemeProvider wrapping entire app
    - Add theme toggle button in header
    - Render NameModal conditionally
    - Render MessageList with messages
    - Render MessageInput at bottom
    - Apply responsive layout for mobile and desktop
    - _Requirements: 12.1, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 15. Implement mobile optimizations
  - [x] 15.1 Add touch gesture support
    - Implement long-press detection (500ms) for message actions
    - Add swipe-right gesture on messages to trigger reply
    - Handle touch events for emoji picker
    - Ensure 44x44px minimum tap targets for all interactive elements
    - _Requirements: 13.2, 13.3_
  
  - [x] 15.2 Optimize for mobile viewports
    - Test and adjust layout for 320px to 768px widths
    - Handle virtual keyboard appearance (adjust viewport)
    - Prevent zoom on input focus
    - Use native file picker on mobile devices
    - _Requirements: 13.1, 13.4_
  
  - [x] 15.3 Add mobile-specific UI enhancements
    - Implement pull-to-refresh for loading older messages
    - Add haptic feedback on actions (if supported)
    - Optimize touch scrolling performance
    - Test on iOS Safari and Android Chrome
    - _Requirements: 13.4, 13.5_

- [x] 16. Implement performance optimizations
  - [x] 16.1 Add code splitting and lazy loading
    - Lazy load EmojiPicker component
    - Lazy load image viewer/lightbox component
    - Split API routes into separate chunks
    - _Requirements: 14.2, 14.5_
  
  - [x] 16.2 Optimize images and assets
    - Use Next.js Image component for all images
    - Implement lazy loading for images below fold
    - Generate and serve WebP format with fallbacks
    - Compress and optimize static assets
    - _Requirements: 6.5, 14.1, 14.2_
  
  - [x] 16.3 Implement caching strategies
    - Set cache headers for static assets (1 year)
    - Cache user data (name, theme, country) in localStorage
    - Add service worker for offline support (optional)
    - _Requirements: 1.4, 2.4, 12.3, 12.4_

- [x] 17. Add error handling and validation
  - [x] 17.1 Implement client-side error boundaries
    - Create ErrorBoundary component wrapping ChatRoom
    - Add fallback UI for runtime errors
    - Log errors to console or error tracking service
    - _Requirements: 14.1_
  
  - [x] 17.2 Add API error handling
    - Standardize error response format across all API routes
    - Implement proper HTTP status codes
    - Add rate limiting to prevent abuse (10 req/min per IP)
    - Validate all inputs and return clear error messages
    - _Requirements: 5.1, 5.2, 6.1, 10.3, 11.3_
  
  - [x] 17.3 Handle connection failures
    - Show offline indicator when network unavailable
    - Display Pusher connection errors to user
    - Implement reconnection logic for Pusher
    - Queue messages for sending when connection restored
    - _Requirements: 5.5_

- [x] 18. Implement security measures
  - Add input sanitization to prevent XSS attacks
  - Validate file types and sizes on server side
  - Implement rate limiting on all API endpoints
  - Verify userName ownership for edit/delete operations
  - Add CORS configuration for API routes
  - Sanitize URLs before rendering as links
  - _Requirements: 5.1, 6.3, 6.4, 10.2, 11.2_

- [x] 19. Create app layout and root configuration
  - Set up app/layout.tsx with metadata and fonts
  - Configure global CSS imports
  - Add viewport meta tags for mobile
  - Set up analytics (Vercel Analytics)
  - Configure error tracking (optional)
  - _Requirements: 13.1, 14.3_

- [x] 20. Final polish and deployment preparation
  - [x] 20.1 Verify all design system elements
    - Audit all components for design consistency
    - Ensure proper spacing and typography throughout
    - Verify smooth animations and transitions
    - Test theme switching across all components
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [x] 20.2 Performance audit
    - Run Lighthouse tests (target score > 90)
    - Verify bundle size < 200KB gzipped
    - Test FCP < 1s and TTI < 2s
    - Optimize any performance bottlenecks
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [x] 20.3 Cross-browser and device testing
    - Test on Chrome, Firefox, Safari, Edge
    - Test on iOS Safari and Android Chrome
    - Verify responsive behavior at all breakpoints
    - Test all features on mobile devices
    - _Requirements: 13.4, 13.5_
  
  - [x] 20.4 Configure Vercel deployment
    - Set all environment variables in Vercel dashboard
    - Configure build settings and regions
    - Set up custom domain (if applicable)
    - Enable Vercel Analytics
    - Deploy to production
    - _Requirements: 14.1, 14.2_
