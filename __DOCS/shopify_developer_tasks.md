# Shopify Developer Tasks - Krosspost.ai

## Shopify App Setup

### Task 1: OAuth & App Configuration
- Build public embedded Shopify app with OAuth installation flow
- Configure required scopes: `read_products`, `read_inventory`, `write_draft_orders`, `write_orders`, `read_customers`, `write_customers`
- Plan for optional `read_all_orders` scope for future implementation
- Implement uninstall cleanup and scope justification for Shopify app store guidelines

## Instagram/Meta Integration

### Task 2: Instagram API Setup
- Integrate Instagram Graph API + Instagram Messaging (Messenger Platform)
- Configure webhooks for comments, DMs, and message sending
- Implement Meta 24-hour rule and rate limit compliance

### Task 3: Event Listeners
- Set up webhook handlers for comment triggers on posts/reels/live videos
- Set up webhook handlers for DM triggers
- Support configurable keywords: "claim", "buy", "M", "drop1" for comments
- Support DM triggers: "link", "pay", emoji, quick replies

## Core Claims Engine

### Task 4: Product Mapping System
- Build system to map triggers to product/variant by SKU, handle, or drop list
- Create configuration interface for keyword → product mapping

### Task 5: Draft Order & Inventory Management
- Implement Shopify draft order creation API
- Build inventory reservation system with configurable N-minute hold timer
- Generate checkout links and send via Instagram DM
- Handle out-of-stock scenarios: add to waitlist, trigger DM notification when restocked

### Task 6: AI-Based Reply System
- Implement AI-based replies to comments and DMs using post context

## Shopify Admin Dashboard (Embedded UI)

### Task 7: Campaign Setup Interface
- Build UI to select Instagram account
- Build product/variant selector
- Create keyword configuration interface
- Add settings for hold time and per-person limits

### Task 8: Claims Board
- Display claims list with states: new, link sent, paid, expired, waitlist
- Implement actions: resend link, cancel claim, mark as paid
- Build real-time claim status updates

### Task 9: Analytics Dashboard
- Track funnel: comments → claims → payments → revenue per campaign
- Build analytics visualization in Shopify admin

## Pre-Built Templates (D2C Workspace)

### Task 10: Drop Sale Template
- Trigger: Comment "DROP1 + [size]" to claim
- Flow: Create draft order → hold inventory → send checkout DM

### Task 11: Back in Stock Waitlist Template
- Trigger: DM "WAITLIST" on sold-out reel
- Flow: Add to waitlist → auto-DM when restocked

### Task 12: Try & Buy via DM Template
- Trigger: DM "SIZE HELP"
- Flow: Send size guide → product carousel → checkout link

## Shared Platform Features

### Task 13: Template Framework
- Build template system supporting entry trigger + messages + data capture + links
- Ensure D2C Shopify workspace can use shared crossposting and analytics engine

### Task 14: Multi-Step DM Flows
- Implement multi-step conversation builder
- Support up to 10-link product carousels in DMs
- Build delayed follow-up scheduling system

---

## Summary

**Build a shared crossposting + IG/FB automation platform with three workspaces (Food, Realtor, D2C Shopify), each defined by a set of automation templates, plus a Shopify-embedded app that turns Instagram comments/DMs into draft orders and checkout links with inventory holds and a claims dashboard.**

---

*Generated from KKrosspost-r-D.docx on December 30, 2025*
